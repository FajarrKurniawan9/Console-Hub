<?php

namespace App\Services\Tx;

use App\Connectors\ConsoleClient;
use App\Connectors\ConsoleResponse;
use App\Connectors\Exceptions\ConsoleException;
use App\Jobs\FinishTransaction;
use App\Models\Console;
use App\Models\Transaction;
use App\Models\TransactionParticipant;
use App\Models\User;
use App\Services\Audit;
use App\Services\Console\ConsoleRegistry;
use App\Services\Tx\Operations\Operation;
use App\Support\ApiError;
use App\Support\ApiException;
use App\Support\Idempotency;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Sleep;

/**
 * Two-phase commit across the consoles ("all or nothing").
 *
 *   start → prepare (parallel, 8 s) → decision written to the DB → commit/abort (idempotent)
 *
 * The decision is stored before phase 2 and is never changed afterwards. Commit and abort that do not
 * finish inside the request are continued by FinishTransaction (queue) and `tx:recover` (scheduler).
 */
class Coordinator
{
    public const PREPARE_TIMEOUT = 8;

    public const PHASE2_TIMEOUT = 8;

    /** How long a request waits for phase 2 before answering 202. */
    public const REQUEST_WAIT_SECONDS = 10;

    /** After this long since the decision, an unfinished commit becomes needs_attention. */
    public const GIVE_UP_SECONDS = 300;

    /** Delays between phase 2 attempts; the last value repeats. */
    public const BACKOFF = [1, 2, 4, 8, 16, 30];

    public function __construct(
        private ConsoleClient $client,
        private ConsoleRegistry $registry,
        private Audit $audit,
    ) {}

    /**
     * Run one write. Returns the transaction in its final state (committed) or still committing (→ 202).
     * Throws ApiException for 409/422/502/504.
     *
     * @param  array<string, mixed>  $input
     * @param  Collection<int, Console>|null  $participants  defaults to all three consoles
     */
    public function run(Operation $operation, array $input, ?string $targetId, ?User $user, string $idempotencyKey, ?Collection $participants = null): Transaction
    {
        $hash = Idempotency::hash($operation->name(), $targetId, $input);

        if ($existing = $this->existing($user, $idempotencyKey, $hash)) {
            return $this->answer($existing, $user);
        }

        $prepared = $operation->prepare($input, $targetId);
        $participants ??= $this->registry->participants();

        try {
            $tx = DB::transaction(function () use ($operation, $prepared, $user, $idempotencyKey, $hash, $participants) {
                $tx = Transaction::query()->create([
                    'operation' => $operation->name(),
                    'entity_type' => $operation->entityType(),
                    'entity_id' => $prepared->entityId,
                    'payload' => $prepared->payload,
                    'state' => 'preparing',
                    'idempotency_key' => $idempotencyKey,
                    'requested_by' => $user?->id,
                    'result' => [
                        'request_hash' => $hash,
                        'version' => $prepared->version,
                        'checksum' => $prepared->checksum,
                        'label' => $prepared->label,
                        'entity' => $prepared->entity,
                        'old' => $prepared->old,
                        'creates' => $operation->creates(),
                    ],
                ]);

                foreach ($participants as $console) {
                    TransactionParticipant::query()->create(['tx_id' => $tx->id, 'console_id' => $console->id]);
                }

                return $tx;
            });
        } catch (QueryException $e) {
            // Two requests with the same key raced; the other one owns the transaction.
            if (str_contains($e->getMessage(), 'transactions_requested_by_idempotency_key_unique') && $existing = $this->existing($user, $idempotencyKey, $hash)) {
                return $this->answer($existing, $user);
            }

            throw $e;
        }

        Context::add('tx_id', $tx->id);
        Log::info('tx.started', ['tx_id' => $tx->id, 'operation' => $tx->operation, 'entity_id' => $tx->entity_id]);

        $this->prepare($tx);
        $this->finish($tx, waitSeconds: self::REQUEST_WAIT_SECONDS);

        $tx->refresh()->load('participants.console');
        $this->recordAudit($tx);

        return $this->answer($tx, $user);
    }

    /**
     * Phase 1 and the decision. After this the transaction is `committing` or `aborting`.
     */
    public function prepare(Transaction $tx): void
    {
        $tx->load('participants.console');
        $consoles = $tx->participants->map(fn (TransactionParticipant $p) => $p->console);
        $body = ['tx_id' => $tx->id, 'operation' => $tx->operation, 'payload' => $tx->payload];

        $answers = $this->client->pool($consoles, fn () => ['POST', '/internal/v1/tx/prepare', $body], self::PREPARE_TIMEOUT);
        $refusalDetails = [];
        $firstError = null;

        foreach ($tx->participants as $participant) {
            $answer = $answers[$participant->console->slug];
            $update = ['attempts' => $participant->attempts + 1, 'prepared_at' => now()];

            if ($answer instanceof ConsoleException) {
                $update += ['prepare_state' => 'error', 'last_error' => $answer->getMessage()];
                $firstError ??= $answer;
            } elseif ($answer->successful() && $answer->get('vote') === 'ok') {
                $update += ['prepare_state' => 'ok', 'latency_ms' => $answer->latencyMs, 'last_error' => null];
            } elseif ($answer->successful() && $answer->get('vote') === 'refuse') {
                $update += [
                    'prepare_state' => 'refused',
                    'latency_ms' => $answer->latencyMs,
                    'refusal_code' => mb_substr((string) $answer->get('code', 'REFUSED'), 0, 40),
                    'refusal_message' => (string) $answer->get('message', ''),
                ];
                $refusalDetails[$participant->console->slug] = (array) $answer->get('details', []);
            } else {
                $error = $this->client->errorFor($participant->console, $answer);
                $update += ['prepare_state' => 'error', 'latency_ms' => $answer->latencyMs, 'last_error' => $error->getMessage()];
                $firstError ??= $error;
            }

            $participant->fill($update)->save();
            $this->logParticipant($tx, $participant, 'prepare', $answer);
        }

        $this->decide($tx, $refusalDetails, $firstError);
    }

    /**
     * Phase 2: send commit or abort to every participant not finished yet. Retries with backoff for up
     * to $waitSeconds inside this call; whatever is left goes to the queue. Safe to call again.
     */
    public function finish(Transaction $tx, int $waitSeconds = 0): void
    {
        $started = microtime(true);
        $waited = 0;
        $attempt = 0;

        while (true) {
            $tx->refresh()->load('participants.console');

            if (! in_array($tx->state, ['committing', 'aborting', 'prepared'], true)) {
                return;
            }

            if ($this->phase2Round($tx)) {
                return;
            }

            if ($this->giveUpIfTooLate($tx)) {
                return;
            }

            $delay = self::BACKOFF[min($attempt, count(self::BACKOFF) - 1)];

            // Count both planned sleeps and real time (calls can take up to 8 s each).
            if ($waited + $delay > $waitSeconds || microtime(true) - $started + $delay > $waitSeconds) {
                FinishTransaction::dispatch($tx->id, $attempt)->delay(now()->addSeconds($delay));

                return;
            }

            Sleep::for($delay)->seconds();
            $waited += $delay;
            $attempt++;
        }
    }

    /**
     * One phase 2 round. Returns true when every participant is done and the transaction is final.
     */
    public function phase2Round(Transaction $tx): bool
    {
        $committing = $tx->state !== 'aborting';
        $target = $committing ? 'committed' : 'aborted';
        // Abort goes to refused participants too: it is idempotent and an unknown tx answers "aborted".
        $pending = $tx->participants->filter(fn (TransactionParticipant $p) => $p->decision_state !== $target);

        if ($pending->isNotEmpty()) {
            $body = $committing ? ['version' => $tx->result['version'] ?? null, 'checksum' => $tx->result['checksum'] ?? null] : [];
            $path = '/internal/v1/tx/'.$tx->id.($committing ? '/commit' : '/abort');
            $answers = $this->client->pool($pending->map(fn (TransactionParticipant $p) => $p->console), fn () => ['POST', $path, $body], self::PHASE2_TIMEOUT);

            foreach ($pending as $participant) {
                $answer = $answers[$participant->console->slug];
                $this->markPhase2($tx, $participant, $answer instanceof ConsoleResponse && $answer->successful(), $answer instanceof ConsoleException ? $answer->getMessage() : "HTTP {$answer->status}");
                $this->logParticipant($tx, $participant, $committing ? 'commit' : 'abort', $answer);
            }
        }

        $allDone = $tx->participants->every(fn (TransactionParticipant $p) => $p->decision_state === $target);

        if ($allDone) {
            $tx->fill(['state' => $committing ? 'committed' : 'aborted', 'finished_at' => now()])->save();
            Log::info("tx.{$tx->state}", ['tx_id' => $tx->id]);
        }

        return $allDone;
    }

    /**
     * Record the phase 2 outcome of one participant (also used by recovery after asking the console).
     */
    public function markPhase2(Transaction $tx, TransactionParticipant $participant, bool $done, ?string $error = null): void
    {
        $committing = $tx->state !== 'aborting';
        $participant->fill([
            'attempts' => $participant->attempts + 1,
            'decision_state' => $done ? ($committing ? 'committed' : 'aborted') : 'failed',
            'version' => $done && $committing ? ($tx->result['version'] ?? null) : $participant->version,
            'last_error' => $done ? null : $error,
            'finished_at' => $done ? now() : null,
        ])->save();
    }

    /**
     * Commit still unfinished 5 minutes after the decision → needs_attention (Admin IT resolves it).
     * Abort keeps retrying: nothing was changed, holds just need releasing.
     */
    public function giveUpIfTooLate(Transaction $tx): bool
    {
        // An admin "retry_commit" restarts the clock, the decision itself stays as recorded.
        $since = isset($tx->result['retry_started_at']) ? Carbon::parse($tx->result['retry_started_at']) : $tx->decided_at;

        if ($tx->state === 'committing' && $since && $since->diffInSeconds(now(), true) >= self::GIVE_UP_SECONDS) {
            $failed = $tx->participants->firstWhere('decision_state', 'failed');
            $tx->fill([
                'state' => 'needs_attention',
                'failure_code' => 'COMMIT_FAILED',
                'failure_console' => $failed?->console->slug,
                'failure_message' => 'Commit belum diterima '.($failed ? $failed->console->name : 'semua console').' setelah 5 menit: '.(($failed ? $failed->last_error : null) ?? 'tanpa jawaban').'.',
            ])->save();
            Log::warning('tx.needs_attention', ['tx_id' => $tx->id, 'console' => $failed?->console->slug]);

            return true;
        }

        return false;
    }

    /**
     * Admin IT action on a `needs_attention` transaction. Only restarts phase 2 and answers at once;
     * the queue finishes the work. The recorded decision (commit) is never turned into something else,
     * except `abort` while no console has committed yet.
     *
     * @param  'retry_commit'|'abort'  $action
     */
    public function resolve(Transaction $tx, string $action, User $admin): Transaction
    {
        $tx->load('participants.console');
        $anyCommitted = $tx->participants->contains('decision_state', 'committed');

        $allowed = $tx->state === 'needs_attention' && match ($action) {
            'retry_commit' => $tx->decided_at !== null && $tx->failure_code === 'COMMIT_FAILED',
            'abort' => ! $anyCommitted,
        };

        if (! $allowed) {
            throw new ApiException(422, 'INVALID_ACTION', match (true) {
                $tx->state !== 'needs_attention' => 'Hanya transaksi berstatus needs_attention yang dapat diselesaikan manual.',
                $action === 'abort' => 'Transaksi tidak dapat dibatalkan: sudah ada console yang menyimpan perubahan. Gunakan commit ulang.',
                default => 'Commit ulang hanya untuk transaksi yang keputusannya commit.',
            });
        }

        $old = ['state' => $tx->state];
        $tx->fill([
            'state' => $action === 'retry_commit' ? 'committing' : 'aborting',
            'result' => [...($tx->result ?? []), 'retry_started_at' => now()->toIso8601String()],
        ])->save();

        $this->audit->record('transaction.resolved', 'transaction', $tx->id, $old, ['tx_id' => $tx->id, 'action' => $action, 'state' => $tx->state], $admin->id);
        Log::info('tx.resolved', ['tx_id' => $tx->id, 'action' => $action, 'by' => $admin->id]);

        FinishTransaction::dispatch($tx->id);

        return $tx;
    }

    /**
     * Answer for the HTTP layer: the transaction when committed or still committing, otherwise the error.
     */
    public function answer(Transaction $tx, ?User $user): Transaction
    {
        $tx->loadMissing('participants.console');

        if (in_array($tx->state, ['aborted', 'aborting'], true)) {
            throw ApiError::forAbortedTransaction($tx, $user?->isAdmin() ?? true);
        }

        return $tx;
    }

    /**
     * @param  array<string, array<string, mixed>>  $refusalDetails
     */
    private function decide(Transaction $tx, array $refusalDetails, ?ConsoleException $firstError): void
    {
        $tx->refresh()->load('participants.console');
        $allOk = $tx->participants->every(fn (TransactionParticipant $p) => $p->prepare_state === 'ok');

        if ($allOk) {
            $tx->fill(['state' => 'committing', 'decided_at' => now()])->save();
            Log::info('tx.decided', ['tx_id' => $tx->id, 'decision' => 'commit']);

            return;
        }

        $refused = $tx->participants->where('prepare_state', 'refused')->sortBy('console_id')->first();
        $errored = $tx->participants->where('prepare_state', 'error')->sortBy('console_id')->first();

        $tx->fill([
            'state' => 'aborting',
            'decided_at' => now(),
            'failure_code' => $refused ? $refused->refusal_code : ($firstError ? $firstError->errorCode : 'CONSOLE_ERROR'),
            'failure_console' => ($refused ?? $errored)?->console->slug,
            'failure_message' => $refused ? $refused->refusal_message : $firstError?->getMessage(),
            'result' => [...($tx->result ?? []), 'refusal_details' => $refusalDetails],
        ])->save();
        Log::info('tx.decided', ['tx_id' => $tx->id, 'decision' => 'abort', 'reason' => $tx->failure_code]);
    }

    private function existing(?User $user, string $key, string $hash): ?Transaction
    {
        $tx = Transaction::query()
            ->where('idempotency_key', $key)
            ->when($user, fn ($q) => $q->where('requested_by', $user->id), fn ($q) => $q->whereNull('requested_by'))
            ->first();

        if ($tx && ($tx->result['request_hash'] ?? null) !== $hash) {
            throw new ApiException(422, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency-Key ini sudah dipakai untuk permintaan lain. Kirim ulang dengan kunci baru.');
        }

        return $tx;
    }

    private function recordAudit(Transaction $tx): void
    {
        $this->audit->record($tx->operation, $tx->entity_type, $tx->entity_id, $tx->result['old'] ?? null, [
            ...($tx->result['entity'] ?? []),
            'tx_id' => $tx->id,
            'state' => $tx->state,
            'failure_code' => $tx->failure_code,
        ], $tx->requested_by);
    }

    private function logParticipant(Transaction $tx, TransactionParticipant $p, string $phase, ConsoleResponse|ConsoleException $answer): void
    {
        Log::info("tx.{$phase}", [
            'tx_id' => $tx->id,
            'console' => $p->console->slug,
            'prepare_state' => $p->prepare_state,
            'decision_state' => $p->decision_state,
            'status' => $answer instanceof ConsoleResponse ? $answer->status : $answer->errorCode,
            'latency_ms' => $answer instanceof ConsoleResponse ? $answer->latencyMs : null,
        ]);
    }
}
