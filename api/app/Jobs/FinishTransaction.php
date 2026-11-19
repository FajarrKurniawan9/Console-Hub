<?php

namespace App\Jobs;

use App\Models\Transaction;
use App\Services\Tx\Coordinator;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Context;

/**
 * One more phase 2 round for a decided transaction; schedules the next one with backoff until done
 * (or, for commits, until needs_attention after 5 minutes).
 */
class FinishTransaction implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public function __construct(public string $txId, public int $attempt = 0)
    {
        $this->onQueue('tx');
    }

    public function handle(Coordinator $coordinator): void
    {
        $tx = Transaction::query()->with('participants.console')->find($this->txId);

        if (! $tx || ! in_array($tx->state, ['committing', 'aborting', 'prepared'], true)) {
            return;
        }

        Context::add('tx_id', $tx->id);

        if ($coordinator->phase2Round($tx) || $coordinator->giveUpIfTooLate($tx->refresh()->load('participants.console'))) {
            return;
        }

        $next = $this->attempt + 1;
        self::dispatch($tx->id, $next)->delay(now()->addSeconds(Coordinator::BACKOFF[min($next, count(Coordinator::BACKOFF) - 1)]));
    }
}
