<?php

namespace App\Services\Tx;

use App\Connectors\ConsoleClient;
use App\Connectors\Exceptions\ConsoleException;
use App\Models\Transaction;
use App\Models\TransactionParticipant;
use Illuminate\Support\Facades\Log;

/**
 * Continues transactions cut off mid-way (crash, deploy, lost worker). Run every minute by `tx:recover`.
 *
 *   preparing > 2 min    → decide abort (the votes may be incomplete)
 *   prepared, committing → continue commit
 *   aborting             → continue abort
 *
 * Before resending phase 2 it asks each unfinished console `GET /internal/v1/tx/{id}`, so work a
 * console already did is recorded instead of repeated.
 */
class Recovery
{
    public const STALE_PREPARING_SECONDS = 120;

    public function __construct(private Coordinator $coordinator, private ConsoleClient $client) {}

    /**
     * @return array<string, int> how many transactions were handled per starting state
     */
    public function run(): array
    {
        $handled = ['preparing' => 0, 'prepared' => 0, 'committing' => 0, 'aborting' => 0];

        Transaction::query()
            ->where(fn ($q) => $q->whereIn('state', ['prepared', 'committing', 'aborting'])
                ->orWhere(fn ($q) => $q->where('state', 'preparing')->where('created_at', '<', now()->subSeconds(self::STALE_PREPARING_SECONDS))))
            ->orderBy('created_at')
            ->limit(100)
            ->get()
            ->each(function (Transaction $tx) use (&$handled) {
                $handled[$tx->state]++;
                $this->recover($tx);
            });

        return $handled;
    }

    public function recover(Transaction $tx): void
    {
        $tx->load('participants.console');

        if ($tx->state === 'preparing') {
            $tx->fill([
                'state' => 'aborting',
                'decided_at' => now(),
                'failure_code' => 'CONSOLE_TIMEOUT',
                'failure_message' => 'Fase prepare tidak selesai dalam 2 menit; transaksi dibatalkan oleh pemulihan.',
            ])->save();
            Log::warning('tx.recover.abort_stale', ['tx_id' => $tx->id]);
        }

        if ($tx->state === 'prepared') {
            $tx->fill(['state' => 'committing', 'decided_at' => $tx->decided_at ?? now()])->save();
        }

        $this->syncFromConsoles($tx);

        $tx->refresh()->load('participants.console');

        if (! $this->coordinator->phase2Round($tx)) {
            $this->coordinator->giveUpIfTooLate($tx->refresh()->load('participants.console'));
        }
    }

    /**
     * Record what each unfinished console already did according to its own `GET /tx/{id}`.
     */
    private function syncFromConsoles(Transaction $tx): void
    {
        $target = $tx->state === 'aborting' ? 'aborted' : 'committed';
        $pending = $tx->participants->filter(fn (TransactionParticipant $p) => $p->decision_state !== $target);

        if ($pending->isEmpty()) {
            return;
        }

        $answers = $this->client->pool($pending->map(fn (TransactionParticipant $p) => $p->console), fn () => ['GET', "/internal/v1/tx/{$tx->id}", null], Coordinator::PHASE2_TIMEOUT);

        foreach ($pending as $participant) {
            $answer = $answers[$participant->console->slug];

            if ($answer instanceof ConsoleException || ! $answer->successful()) {
                continue;
            }

            if ($answer->get('state') === $target || ($target === 'aborted' && $answer->status === 404)) {
                $this->coordinator->markPhase2($tx, $participant, true);
            }
        }
    }
}
