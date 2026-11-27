<?php

namespace App\Services\Imports;

use App\Connectors\ConsoleResponse;
use App\Connectors\Exceptions\ConsoleException;
use App\Jobs\ProcessDataImportChunk;
use App\Models\DataImport;
use App\Models\User;
use App\Services\Audit;
use App\Services\Sources\SourceRegistry;
use App\Support\ApiException;
use App\Support\Iso;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Sleep;

/**
 * Orchestrates dry-run preview, revalidation, per-resource lock commit, chunked execution with
 * rate-limit pacing, 429/409 handling, cooperative cancellation, and stuck-job recovery.
 */
class ImportExecutionService
{
    public const CHUNK_SIZE = 25;

    public const WRITE_PACING_MS = 750;

    public const NEXT_CHUNK_DELAY_SECONDS = 5;

    public const DEFAULT_RETRY_AFTER_SECONDS = 15;

    public const MAX_RETRY_AFTER_SECONDS = 120;

    public const MAX_BACKOFF_ATTEMPTS = 3;

    public const MAX_CONSECUTIVE_UNREACHABLE = 3;

    public const STUCK_MINUTES = 10;

    public function __construct(
        private TabularFileReader $reader,
        private ImportValidator $validator,
        private SourceRegistry $sources,
        private Audit $audit,
    ) {}

    public function createPreview(User $actor, string $type, string $mode, UploadedFile $file): DataImport
    {
        $parsed = $this->reader->read($file, $type);
        $plan = $this->validator->buildPlan($type, $mode, $parsed['rows'], $actor);

        return DataImport::query()->create([
            'user_id' => $actor->id,
            'requester_role' => $actor->role->code,
            'type' => $type,
            'mode' => $mode,
            'status' => DataImport::STATUS_PREVIEW,
            'original_filename' => $parsed['filename'],
            'file_format' => $parsed['format'],
            'total_rows' => $plan['total_rows'],
            'valid_rows' => $plan['valid_rows'],
            'create_count' => $plan['create_count'],
            'update_count' => $plan['update_count'],
            'skip_count' => $plan['skip_count'],
            'invalid_count' => $plan['invalid_count'],
            'source_rows' => $parsed['rows'],
            'plan_rows' => $plan['plan_rows'],
            'validated_at' => now(),
        ]);
    }

    public function revalidate(DataImport $import, User $actor): DataImport
    {
        if ($import->status !== DataImport::STATUS_PREVIEW) {
            throw new ApiException(
                409,
                'CONFLICT',
                'Sesi pratinjau tidak dapat divalidasi ulang karena statusnya bukan preview.',
                ['reason' => 'INVALID_STATE'],
            );
        }

        $sourceRows = $import->source_rows ?? [];

        if ($sourceRows === []) {
            throw new ApiException(
                409,
                'CONFLICT',
                'Data baris mentah pratinjau sudah tidak tersedia. Unggah ulang file.',
                ['reason' => 'INVALID_STATE'],
            );
        }

        $plan = $this->validator->buildPlan($import->type, $import->mode, $sourceRows, $actor);

        $import->update([
            'total_rows' => $plan['total_rows'],
            'valid_rows' => $plan['valid_rows'],
            'create_count' => $plan['create_count'],
            'update_count' => $plan['update_count'],
            'skip_count' => $plan['skip_count'],
            'invalid_count' => $plan['invalid_count'],
            'plan_rows' => $plan['plan_rows'],
            'error_message' => null,
            'validated_at' => now(),
        ]);

        return $import->refresh();
    }

    public function commit(DataImport $import, User $actor): DataImport
    {
        if ($import->status !== DataImport::STATUS_PREVIEW) {
            throw new ApiException(
                409,
                'CONFLICT',
                'Tiket impor tidak berada pada tahap pratinjau.',
                ['reason' => 'INVALID_STATE'],
            );
        }

        if ($import->invalid_count > 0) {
            throw ApiException::validation([
                'file' => ["Masih terdapat {$import->invalid_count} baris invalid. Perbaiki semua error sebelum menjalankan impor."],
            ], 'Terdapat baris invalid pada pratinjau impor.');
        }

        if ($import->validated_at !== null) {
            $staleExists = DataImport::query()
                ->where('type', $import->type)
                ->whereKeyNot($import->id)
                ->whereIn('status', [
                    DataImport::STATUS_COMPLETED,
                    DataImport::STATUS_FAILED,
                    DataImport::STATUS_CANCELLED,
                ])
                ->whereNotNull('completed_at')
                ->where('completed_at', '>', $import->validated_at)
                ->exists();

            if ($staleExists) {
                throw new ApiException(
                    409,
                    'CONFLICT',
                    'Data sumber telah berubah oleh impor lain setelah pratinjau dibuat. Klik Validasi Ulang sebelum menjalankan impor.',
                    ['reason' => 'STALE_PREVIEW'],
                );
            }
        }

        $activeOther = DataImport::query()
            ->with('user:id,name')
            ->where('type', $import->type)
            ->whereIn('status', DataImport::ACTIVE_STATUSES)
            ->first();

        if ($activeOther !== null) {
            throw $this->lockedException($activeOther, $actor->id);
        }

        $now = now();

        try {
            $updated = DB::transaction(static function () use ($import, $now): int {
                return DataImport::query()
                    ->whereKey($import->id)
                    ->where('status', DataImport::STATUS_PREVIEW)
                    ->update([
                        'status' => DataImport::STATUS_QUEUED,
                        'processed_rows' => 0,
                        'created_count' => 0,
                        'updated_count' => 0,
                        'skipped_count' => 0,
                        'failed_count' => 0,
                        'cursor_index' => 0,
                        'execution_results' => [],
                        'error_message' => null,
                        'started_at' => $now,
                        'last_chunk_at' => $now,
                        'completed_at' => null,
                        'cancel_requested_at' => null,
                        'cancelled_at' => null,
                    ]);
            });
        } catch (QueryException $e) {
            if ($this->isUniqueConstraintViolation($e)) {
                $active = DataImport::query()
                    ->with('user:id,name')
                    ->where('type', $import->type)
                    ->whereIn('status', DataImport::ACTIVE_STATUSES)
                    ->first();

                if ($active !== null) {
                    throw $this->lockedException($active, $actor->id);
                }

                throw new ApiException(
                    409,
                    'CONFLICT',
                    'Sedang ada impor lain yang aktif untuk entitas ini.',
                    ['reason' => 'RESOURCE_LOCKED'],
                );
            }

            throw $e;
        }

        if ($updated === 0) {
            throw new ApiException(
                409,
                'CONFLICT',
                'Status tiket impor sudah berubah sebelum commit diproses.',
                ['reason' => 'INVALID_STATE'],
            );
        }

        $import->refresh();

        $this->recordAudit($import, 'import.started', [
            'type' => $import->type,
            'mode' => $import->mode,
            'filename' => $import->original_filename,
            'total_rows' => $import->total_rows,
            'planned_create' => $import->create_count,
            'planned_update' => $import->update_count,
            'planned_skip' => $import->skip_count,
        ], $actor->id);

        ProcessDataImportChunk::dispatch($import->id)->onQueue('default');

        return $import->refresh();
    }

    public function cancel(DataImport $import): DataImport
    {
        $now = now();

        if (in_array($import->status, [DataImport::STATUS_PREVIEW, DataImport::STATUS_QUEUED], true)) {
            $wasQueued = $import->status === DataImport::STATUS_QUEUED;

            $updated = DataImport::query()
                ->whereKey($import->id)
                ->whereIn('status', [DataImport::STATUS_PREVIEW, DataImport::STATUS_QUEUED])
                ->update([
                    'status' => DataImport::STATUS_CANCELLED,
                    'cancelled_at' => $now,
                    'completed_at' => $now,
                ]);

            if ($updated === 0) {
                $fresh = $import->fresh();
                if ($fresh !== null && $fresh->status === DataImport::STATUS_PROCESSING) {
                    return $this->requestProcessingCancellation($fresh);
                }

                throw new ApiException(
                    409,
                    'CONFLICT',
                    'Tiket impor tidak dapat dibatalkan karena sudah selesai.',
                    ['reason' => 'INVALID_STATE'],
                );
            }

            if ($wasQueued) {
                $this->purgeQueuedJobs($import->id);
                $import->refresh();
                $this->recordAudit($import, 'import.cancelled', [
                    'type' => $import->type,
                    'mode' => $import->mode,
                    'processed_rows' => $import->processed_rows,
                ], $import->user_id);
            }

            return $import->refresh();
        }

        if ($import->status === DataImport::STATUS_PROCESSING) {
            return $this->requestProcessingCancellation($import);
        }

        throw new ApiException(
            409,
            'CONFLICT',
            'Tiket impor tidak dapat dibatalkan karena sudah berada pada status akhir.',
            ['reason' => 'INVALID_STATE'],
        );
    }

    public function processChunk(int $importId, int $backoffAttempt = 0): void
    {
        $now = now();

        DataImport::query()
            ->whereKey($importId)
            ->where('status', DataImport::STATUS_QUEUED)
            ->update([
                'status' => DataImport::STATUS_PROCESSING,
                'last_chunk_at' => $now,
            ]);

        $import = DataImport::query()->find($importId);

        if ($import === null || $import->status !== DataImport::STATUS_PROCESSING) {
            return;
        }

        Context::add('acting_user', (string) $import->user_id);

        if ($import->cancel_requested_at !== null) {
            $this->finalizeCancelled($import);

            return;
        }

        if ($import->type === DataImport::TYPE_USERS) {
            $this->executeUsersImport($import);

            return;
        }

        $this->executeConsoleChunk($import, $backoffAttempt);
    }

    /**
     * Mark stuck processing imports (> 10 minutes without chunk heartbeat) as failed and sweep orphaned queued imports.
     *
     * @return array{stuck_failed: int, queued_dispatched: int}
     */
    public function processScheduledSweep(): array
    {
        $cutoff = now()->subMinutes(self::STUCK_MINUTES);

        $stuckImports = DataImport::query()
            ->where('status', DataImport::STATUS_PROCESSING)
            ->where(function ($q) use ($cutoff): void {
                $q->where('last_chunk_at', '<', $cutoff)
                    ->orWhere(fn ($sub) => $sub->whereNull('last_chunk_at')->where('started_at', '<', $cutoff));
            })
            ->get();

        $stuckFailed = 0;

        foreach ($stuckImports as $stuck) {
            /** @var DataImport $stuck */
            $reason = 'Proses impor terhenti melebihi batas waktu.';
            $updated = DataImport::query()
                ->whereKey($stuck->id)
                ->where('status', DataImport::STATUS_PROCESSING)
                ->update([
                    'status' => DataImport::STATUS_FAILED,
                    'error_message' => $reason,
                    'completed_at' => now(),
                ]);

            if ($updated > 0) {
                $stuck->refresh();
                $this->recordAudit($stuck, 'import.failed', [
                    'type' => $stuck->type,
                    'mode' => $stuck->mode,
                    'processed_rows' => $stuck->processed_rows,
                    'created_count' => $stuck->created_count,
                    'updated_count' => $stuck->updated_count,
                    'failed_count' => $stuck->failed_count,
                    'reason' => $reason,
                ], $stuck->user_id);
                $stuckFailed++;
            }
        }

        $queued = DataImport::query()
            ->where('status', DataImport::STATUS_QUEUED)
            ->where(fn ($q) => $q->whereNull('started_at')->orWhere('started_at', '<', now()->subSeconds(30)))
            ->orderBy('id')
            ->get();

        $queuedDispatched = 0;

        foreach ($queued as $ticket) {
            /** @var DataImport $ticket */
            if (! $this->hasQueuedJob($ticket->id)) {
                ProcessDataImportChunk::dispatch($ticket->id)->onQueue('default');
                $queuedDispatched++;
            }
        }

        return ['stuck_failed' => $stuckFailed, 'queued_dispatched' => $queuedDispatched];
    }

    /**
     * Build minimal cross-user active lock summary for GET /imports meta.
     *
     * @return array<string, array<string, mixed>|null>
     */
    public function activeLocksPayload(int $viewerUserId, ?string $onlyType = null): array
    {
        $types = $onlyType !== null && in_array($onlyType, DataImport::TYPES, true)
            ? [$onlyType]
            : DataImport::TYPES;

        $active = DataImport::query()
            ->with('user:id,name')
            ->whereIn('type', $types)
            ->whereIn('status', DataImport::ACTIVE_STATUSES)
            ->get()
            ->keyBy('type');

        $locks = [];

        foreach (DataImport::TYPES as $type) {
            $import = $active->get($type);
            $locks[$type] = $import instanceof DataImport
                ? $this->formatActiveLock($import, $viewerUserId)
                : null;
        }

        return $locks;
    }

    private function requestProcessingCancellation(DataImport $import): DataImport
    {
        if ($import->cancel_requested_at === null) {
            DataImport::query()
                ->whereKey($import->id)
                ->where('status', DataImport::STATUS_PROCESSING)
                ->whereNull('cancel_requested_at')
                ->update(['cancel_requested_at' => now()]);
        }

        return $import->refresh();
    }

    private function executeUsersImport(DataImport $import): void
    {
        $planRows = $import->plan_rows ?? [];
        $results = $import->execution_results ?? [];
        $cursor = $import->cursor_index;
        $processed = $import->processed_rows;
        $created = $import->created_count;
        $updated = $import->updated_count;
        $skipped = $import->skipped_count;
        $failed = $import->failed_count;

        $actor = User::query()->with('role.permissions')->find($import->user_id);
        $actorEmail = $actor !== null ? mb_strtolower($actor->email) : '';

        while ($cursor < count($planRows)) {
            if ($this->isCancellationRequested($import->id)) {
                $this->saveProgress($import, $cursor, $processed, $created, $updated, $skipped, $failed, $results);
                $this->finalizeCancelled($import->refresh());

                return;
            }

            $plan = $planRows[$cursor];
            $rowNumber = (int) ($plan['row_number'] ?? ($cursor + 1));
            $action = (string) ($plan['action'] ?? 'skip');

            if ($action === 'skip') {
                $results[] = $this->resultEntry($rowNumber, 'skipped', 'skip', $plan['target_id'] ?? null, $plan['reason'] ?? 'Dilewati.');
                $skipped++;
                $processed++;
                $cursor++;

                continue;
            }

            $payload = is_array($plan['payload'] ?? null) ? $plan['payload'] : [];

            if ($action === 'create') {
                try {
                    $newUser = User::query()->create([
                        'name' => (string) ($payload['name'] ?? ''),
                        'email' => mb_strtolower((string) ($payload['email'] ?? '')),
                        'password' => null,
                        'role_id' => (int) ($payload['role_id'] ?? 0),
                        'is_active' => true,
                    ]);

                    $results[] = $this->resultEntry($rowNumber, 'created', 'create', (string) $newUser->id, null);
                    $created++;
                } catch (QueryException $e) {
                    $results[] = $this->resultEntry(
                        $rowNumber,
                        $this->isUniqueConstraintViolation($e) ? 'conflict' : 'failed',
                        'create',
                        null,
                        $this->isUniqueConstraintViolation($e) ? 'Email sudah terdaftar saat eksekusi.' : 'Gagal menyimpan pengguna baru.',
                    );
                    $failed++;
                }

                $processed++;
                $cursor++;

                continue;
            }

            if ($action === 'update') {
                $targetId = (int) ($plan['target_id'] ?? 0);
                $expectedUpdatedAt = (string) ($plan['expected_updated_at'] ?? '');
                $targetUser = User::query()->with('role')->find($targetId);

                if ($targetUser === null || ! $targetUser->is_active || Iso::utc($targetUser->updated_at) !== $expectedUpdatedAt) {
                    $results[] = $this->resultEntry(
                        $rowNumber,
                        'conflict',
                        'update',
                        (string) $targetId,
                        'Konflik versi: pengguna telah diubah atau dinonaktifkan orang lain.',
                    );
                    $failed++;
                    $processed++;
                    $cursor++;

                    continue;
                }

                if ($actor !== null && mb_strtolower($targetUser->email) === $actorEmail && isset($payload['role_id'])) {
                    $targetRoleHasManage = DB::table('role_permissions')
                        ->join('permissions', 'permissions.id', '=', 'role_permissions.permission_id')
                        ->where('role_permissions.role_id', (int) $payload['role_id'])
                        ->where('permissions.code', 'admin.rbac.manage')
                        ->exists();

                    if (! $targetRoleHasManage) {
                        $results[] = $this->resultEntry($rowNumber, 'failed', 'update', (string) $targetId, 'Tidak dapat mencabut akses RBAC dari akun Anda sendiri.');
                        $failed++;
                        $processed++;
                        $cursor++;

                        continue;
                    }
                }

                $updates = ['updated_at' => now()];
                if (isset($payload['name'])) {
                    $updates['name'] = (string) $payload['name'];
                }
                if (isset($payload['role_id'])) {
                    $updates['role_id'] = (int) $payload['role_id'];
                }

                $affected = User::query()
                    ->whereKey($targetUser->id)
                    ->where('is_active', true)
                    ->where('updated_at', $targetUser->updated_at)
                    ->update($updates);

                if ($affected === 0) {
                    $results[] = $this->resultEntry($rowNumber, 'conflict', 'update', (string) $targetId, 'Konflik versi saat memperbarui pengguna.');
                    $failed++;
                } else {
                    $results[] = $this->resultEntry($rowNumber, 'updated', 'update', (string) $targetId, null);
                    $updated++;
                }

                $processed++;
                $cursor++;

                continue;
            }

            $results[] = $this->resultEntry($rowNumber, 'failed', $action, $plan['target_id'] ?? null, 'Aksi rencana tidak dikenal.');
            $failed++;
            $processed++;
            $cursor++;
        }

        $this->finalizeCompleted($import, $cursor, $processed, $created, $updated, $skipped, $failed, $results);
    }

    private function executeConsoleChunk(DataImport $import, int $backoffAttempt): void
    {
        $resource = DataImport::RESOURCES[$import->type] ?? null;

        if ($resource === null) {
            $this->finalizeFailed($import, 'Tipe entitas impor tidak valid.');

            return;
        }

        $client = $this->sources->for($resource);
        $planRows = $import->plan_rows ?? [];
        $results = $import->execution_results ?? [];
        $cursor = $import->cursor_index;
        $processed = $import->processed_rows;
        $created = $import->created_count;
        $updated = $import->updated_count;
        $skipped = $import->skipped_count;
        $failed = $import->failed_count;

        $writesInChunk = 0;
        $consecutiveUnreachable = 0;
        $currentBackoff = $backoffAttempt;

        while ($cursor < count($planRows)) {
            $plan = $planRows[$cursor];
            $rowNumber = (int) ($plan['row_number'] ?? ($cursor + 1));
            $action = (string) ($plan['action'] ?? 'skip');

            if ($action === 'skip') {
                $results[] = $this->resultEntry($rowNumber, 'skipped', 'skip', $plan['target_id'] ?? null, $plan['reason'] ?? 'Dilewati.');
                $skipped++;
                $processed++;
                $cursor++;

                continue;
            }

            if ($writesInChunk >= self::CHUNK_SIZE) {
                break;
            }

            if ($this->isCancellationRequested($import->id)) {
                $this->saveProgress($import, $cursor, $processed, $created, $updated, $skipped, $failed, $results);
                $this->finalizeCancelled($import->refresh());

                return;
            }

            if ($writesInChunk > 0) {
                Sleep::for(self::WRITE_PACING_MS)->milliseconds();
            }

            $payload = is_array($plan['payload'] ?? null) ? $plan['payload'] : [];
            $targetId = is_string($plan['target_id'] ?? null) ? $plan['target_id'] : null;

            if ($action === 'update') {
                $body = [...$payload, 'expected_version' => (int) ($plan['expected_version'] ?? 1)];
                $response = $client->sendWrite('PATCH', $targetId, $body);
            } else {
                $response = $client->sendWrite('POST', null, $payload);
            }

            $writesInChunk++;

            if ($response instanceof ConsoleException) {
                $consecutiveUnreachable++;
                $results[] = $this->resultEntry($rowNumber, 'failed', $action, $targetId, $response->userMessage());
                $failed++;
                $processed++;
                $cursor++;
                $currentBackoff = 0;

                if ($consecutiveUnreachable >= self::MAX_CONSECUTIVE_UNREACHABLE) {
                    $this->saveProgress($import, $cursor, $processed, $created, $updated, $skipped, $failed, $results);
                    $this->finalizeFailed(
                        $import->refresh(),
                        'Console tujuan tidak dapat dihubungi 3 kali berturut-turut. Impor dihentikan sementara.',
                    );

                    return;
                }

                continue;
            }

            if ($response->status === 429) {
                if ($currentBackoff < self::MAX_BACKOFF_ATTEMPTS) {
                    $retryAfter = $this->parseRetryAfter($response->header('Retry-After'));
                    $this->saveProgress($import, $cursor, $processed, $created, $updated, $skipped, $failed, $results);
                    ProcessDataImportChunk::dispatch($import->id, $currentBackoff + 1)
                        ->onQueue('default')
                        ->delay(now()->addSeconds($retryAfter));

                    return;
                }

                $results[] = $this->resultEntry(
                    $rowNumber,
                    'failed',
                    $action,
                    $targetId,
                    'Batas rate limit console terlampaui setelah 3 kali percobaan ulang.',
                );
                $failed++;
                $processed++;
                $cursor++;
                $currentBackoff = 0;

                continue;
            }

            $currentBackoff = 0;

            if ($response->successful() && is_array($response->get('data'))) {
                $consecutiveUnreachable = 0;
                $saved = $response->get('data');
                $savedId = is_string($saved['id'] ?? null) ? $saved['id'] : $targetId;
                $status = $action === 'update' ? 'updated' : 'created';
                $results[] = $this->resultEntry($rowNumber, $status, $action, $savedId, null);

                if ($action === 'update') {
                    $updated++;
                } else {
                    $created++;
                }

                $processed++;
                $cursor++;

                continue;
            }

            $code = $response->get('error.code');

            if ($code === 'VERSION_CONFLICT') {
                $consecutiveUnreachable = 0;
                $currentVersion = $response->get('error.details.current_version');
                $suffix = is_numeric($currentVersion) ? " (versi terbaru: {$currentVersion})" : '';
                $results[] = $this->resultEntry(
                    $rowNumber,
                    'conflict',
                    $action,
                    $targetId,
                    "Konflik versi: data telah diubah pengguna lain{$suffix}.",
                );
                $failed++;
                $processed++;
                $cursor++;

                continue;
            }

            if ($response->status >= 500) {
                $consecutiveUnreachable++;
                $results[] = $this->resultEntry(
                    $rowNumber,
                    'failed',
                    $action,
                    $targetId,
                    'Console tujuan mengalami gangguan server sementara.',
                );
                $failed++;
                $processed++;
                $cursor++;

                if ($consecutiveUnreachable >= self::MAX_CONSECUTIVE_UNREACHABLE) {
                    $this->saveProgress($import, $cursor, $processed, $created, $updated, $skipped, $failed, $results);
                    $this->finalizeFailed(
                        $import->refresh(),
                        'Console tujuan gagal merespons 3 kali berturut-turut. Impor dihentikan sementara.',
                    );

                    return;
                }

                continue;
            }

            $consecutiveUnreachable = 0;
            $reason = $this->friendlyWriteFailure($response, $code);
            $results[] = $this->resultEntry($rowNumber, 'failed', $action, $targetId, $reason);
            $failed++;
            $processed++;
            $cursor++;
        }

        if ($cursor < count($planRows)) {
            $this->saveProgress($import, $cursor, $processed, $created, $updated, $skipped, $failed, $results);

            if ($this->isCancellationRequested($import->id)) {
                $this->finalizeCancelled($import->refresh());

                return;
            }

            ProcessDataImportChunk::dispatch($import->id, 0)
                ->onQueue('default')
                ->delay(now()->addSeconds(self::NEXT_CHUNK_DELAY_SECONDS));

            return;
        }

        $this->finalizeCompleted($import, $cursor, $processed, $created, $updated, $skipped, $failed, $results);
    }

    private function friendlyWriteFailure(ConsoleResponse $response, mixed $code): string
    {
        if ($code === 'DUPLICATE') {
            return 'Data duplikat terdeteksi di console tujuan.';
        }

        if ($response->status === 404) {
            return 'Data target tidak ditemukan di console tujuan.';
        }

        if ($response->status === 422) {
            $apiMsg = $response->get('error.message');

            return is_string($apiMsg) && $apiMsg !== '' ? $apiMsg : 'Validasi ditolak oleh console tujuan.';
        }

        return "Permintaan ditolak oleh console tujuan (HTTP {$response->status}).";
    }

    private function parseRetryAfter(?string $header): int
    {
        if ($header === null || trim($header) === '') {
            return self::DEFAULT_RETRY_AFTER_SECONDS;
        }

        $trimmed = trim($header);

        if (ctype_digit($trimmed)) {
            return max(1, min(self::MAX_RETRY_AFTER_SECONDS, (int) $trimmed));
        }

        return self::DEFAULT_RETRY_AFTER_SECONDS;
    }

    /**
     * @param  list<array<string, mixed>>  $results
     */
    private function saveProgress(
        DataImport $import,
        int $cursor,
        int $processed,
        int $created,
        int $updated,
        int $skipped,
        int $failed,
        array $results,
    ): void {
        $import->update([
            'cursor_index' => $cursor,
            'processed_rows' => $processed,
            'created_count' => $created,
            'updated_count' => $updated,
            'skipped_count' => $skipped,
            'failed_count' => $failed,
            'execution_results' => $results,
            'last_chunk_at' => now(),
        ]);
    }

    /**
     * @param  list<array<string, mixed>>  $results
     */
    private function finalizeCompleted(
        DataImport $import,
        int $cursor,
        int $processed,
        int $created,
        int $updated,
        int $skipped,
        int $failed,
        array $results,
    ): void {
        $now = now();

        $import->update([
            'status' => DataImport::STATUS_COMPLETED,
            'cursor_index' => $cursor,
            'processed_rows' => $processed,
            'created_count' => $created,
            'updated_count' => $updated,
            'skipped_count' => $skipped,
            'failed_count' => $failed,
            'execution_results' => $results,
            'last_chunk_at' => $now,
            'completed_at' => $now,
        ]);

        $this->recordAudit($import, 'import.completed', [
            'type' => $import->type,
            'mode' => $import->mode,
            'created_count' => $created,
            'updated_count' => $updated,
            'skipped_count' => $skipped,
            'failed_count' => $failed,
        ], $import->user_id);
    }

    private function finalizeFailed(DataImport $import, string $reason): void
    {
        $now = now();

        $import->update([
            'status' => DataImport::STATUS_FAILED,
            'error_message' => $reason,
            'last_chunk_at' => $now,
            'completed_at' => $now,
        ]);

        $this->recordAudit($import, 'import.failed', [
            'type' => $import->type,
            'mode' => $import->mode,
            'processed_rows' => $import->processed_rows,
            'created_count' => $import->created_count,
            'updated_count' => $import->updated_count,
            'failed_count' => $import->failed_count,
            'reason' => $reason,
        ], $import->user_id);
    }

    private function finalizeCancelled(DataImport $import): void
    {
        $now = now();

        $import->update([
            'status' => DataImport::STATUS_CANCELLED,
            'cancelled_at' => $import->cancel_requested_at ?? $now,
            'last_chunk_at' => $now,
            'completed_at' => $now,
        ]);

        $this->recordAudit($import, 'import.cancelled', [
            'type' => $import->type,
            'mode' => $import->mode,
            'processed_rows' => $import->processed_rows,
        ], $import->user_id);
    }

    private function isCancellationRequested(int $importId): bool
    {
        return DataImport::query()
            ->whereKey($importId)
            ->where(fn ($q) => $q->whereNotNull('cancel_requested_at')->orWhere('status', DataImport::STATUS_CANCELLED))
            ->exists();
    }

    /**
     * @return array<string, mixed>
     */
    private function resultEntry(int $rowNumber, string $status, string $action, ?string $targetId, ?string $reason): array
    {
        return [
            'row_number' => $rowNumber,
            'status' => $status,
            'action' => $action,
            'target_id' => $targetId,
            'reason' => $reason,
        ];
    }

    private function lockedException(DataImport $active, int $viewerUserId): ApiException
    {
        return new ApiException(
            409,
            'CONFLICT',
            "Impor untuk entitas {$active->type} sedang dijalankan oleh {$active->user->name}. Tunggu hingga selesai.",
            [
                'reason' => 'RESOURCE_LOCKED',
                'active_import' => $this->formatActiveLock($active, $viewerUserId),
            ],
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function formatActiveLock(DataImport $active, int $viewerUserId): array
    {
        return [
            'id' => $active->id,
            'type' => $active->type,
            'status' => $active->status,
            'requester_name' => $active->relationLoaded('user') ? $active->user->name : null,
            'processed_rows' => $active->processed_rows,
            'total_rows' => $active->total_rows,
            'started_at' => Iso::utc($active->started_at),
            'is_mine' => $active->user_id === $viewerUserId,
        ];
    }

    /**
     * @param  array<string, mixed>  $new
     */
    private function recordAudit(DataImport $import, string $action, array $new, int $userId): void
    {
        $consoleSlug = DataImport::CONSOLE_SLUGS[$import->type] ?? null;

        if ($consoleSlug !== null) {
            $new['console'] = $consoleSlug;
        }

        try {
            $this->audit->record($action, 'data_import', (string) $import->id, null, $new, $userId);
        } catch (\Throwable $e) {
            Log::error('Audit write failed for data import', [
                'import_id' => $import->id,
                'action' => $action,
                'exception' => $e::class,
            ]);
        }
    }

    private function purgeQueuedJobs(int $importId): void
    {
        $table = (string) config('queue.connections.database.table', 'jobs');
        $connectionName = app()->runningUnitTests()
            ? (string) config('database.default')
            : (string) (config('queue.connections.database.connection') ?: config('database.default'));

        if (! DB::connection($connectionName)->getSchemaBuilder()->hasTable($table)) {
            return;
        }

        $jobs = DB::connection($connectionName)
            ->table($table)
            ->select(['id', 'payload'])
            ->where('queue', 'default')
            ->whereNull('reserved_at')
            ->get();

        $toDelete = [];

        foreach ($jobs as $job) {
            $payload = json_decode((string) $job->payload, true);

            if (! is_array($payload)) {
                continue;
            }

            $commandName = $payload['data']['commandName'] ?? ($payload['displayName'] ?? null);
            $command = $payload['data']['command'] ?? null;

            if ($commandName !== ProcessDataImportChunk::class || ! is_string($command)) {
                continue;
            }

            if (preg_match('/"importId";i:(\d+);/', $command, $matches) === 1 && (int) $matches[1] === $importId) {
                $toDelete[] = (int) $job->id;
            }
        }

        if ($toDelete !== []) {
            DB::connection($connectionName)
                ->table($table)
                ->whereIn('id', $toDelete)
                ->whereNull('reserved_at')
                ->delete();
        }
    }

    private function hasQueuedJob(int $importId): bool
    {
        $table = (string) config('queue.connections.database.table', 'jobs');
        $connectionName = app()->runningUnitTests()
            ? (string) config('database.default')
            : (string) (config('queue.connections.database.connection') ?: config('database.default'));

        if (! DB::connection($connectionName)->getSchemaBuilder()->hasTable($table)) {
            return false;
        }

        $jobs = DB::connection($connectionName)
            ->table($table)
            ->select(['payload'])
            ->where('queue', 'default')
            ->get();

        foreach ($jobs as $job) {
            $payload = json_decode((string) $job->payload, true);

            if (! is_array($payload)) {
                continue;
            }

            $commandName = $payload['data']['commandName'] ?? ($payload['displayName'] ?? null);
            $command = $payload['data']['command'] ?? null;

            if ($commandName === ProcessDataImportChunk::class
                && is_string($command)
                && preg_match('/"importId";i:(\d+);/', $command, $matches) === 1
                && (int) $matches[1] === $importId) {
                return true;
            }
        }

        return false;
    }

    private function isUniqueConstraintViolation(QueryException $e): bool
    {
        $sqlState = (string) ($e->errorInfo[0] ?? $e->getCode());
        $message = strtolower($e->getMessage());

        if ($sqlState === '23505') {
            return true;
        }

        return $sqlState === '23000' && str_contains($message, 'unique constraint failed');
    }
}
