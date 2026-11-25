<?php

namespace App\Services\Reports;

use App\Jobs\ProcessReportExport;
use App\Models\ReportExport;
use Illuminate\Support\Facades\DB;

/**
 * Atomically cancels scheduled/pending report exports and removes matching unreserved jobs from the queue table.
 */
class ReportExportCanceller
{
    /**
     * Attempt to cancel a `scheduled` or `pending` export ticket.
     * Returns false when the ticket is already processing, completed, failed, or cancelled.
     */
    public function cancel(ReportExport $export, ?string $reason = null): bool
    {
        $now = now()->utc()->toIso8601String();

        $attributes = [
            'status' => ReportExport::STATUS_CANCELLED,
            'cancelled_at' => $now,
        ];

        if ($reason !== null) {
            $attributes['error_message'] = $reason;
        }

        $updated = ReportExport::query()
            ->whereKey($export->id)
            ->whereIn('status', ReportExport::CANCELLABLE_STATUSES)
            ->update($attributes);

        if ($updated === 0) {
            return false;
        }

        $exportIdsToPurge = [$export->id];

        // When cancelling a recurring schedule, also cancel any pending child runs spawned by it.
        if ($export->schedule_type === ReportExport::SCHEDULE_RECURRING) {
            $pendingChildIds = ReportExport::query()
                ->where('parent_export_id', $export->id)
                ->where('status', ReportExport::STATUS_PENDING)
                ->pluck('id')
                ->map(fn (mixed $id) => (int) $id)
                ->all();

            if ($pendingChildIds !== []) {
                ReportExport::query()
                    ->whereIn('id', $pendingChildIds)
                    ->where('status', ReportExport::STATUS_PENDING)
                    ->update([
                        'status' => ReportExport::STATUS_CANCELLED,
                        'cancelled_at' => $now,
                    ]);

                $exportIdsToPurge = [...$exportIdsToPurge, ...$pendingChildIds];
            }
        }

        $this->purgeQueuedJobs($exportIdsToPurge);

        return true;
    }

    /**
     * Remove unreserved `ProcessReportExport` rows from the database queue table for the cancelled export IDs.
     *
     * @param  list<int>  $exportIds
     */
    private function purgeQueuedJobs(array $exportIds): void
    {
        if ($exportIds === []) {
            return;
        }

        $table = (string) config('queue.connections.database.table', 'jobs');
        $connectionName = app()->runningUnitTests()
            ? (string) config('database.default')
            : (string) (config('queue.connections.database.connection') ?: config('database.default'));

        $jobs = DB::connection($connectionName)
            ->table($table)
            ->select(['id', 'payload'])
            ->where('queue', 'exports')
            ->whereNull('reserved_at')
            ->get();

        $jobIdsToDelete = [];

        foreach ($jobs as $job) {
            $payload = json_decode((string) $job->payload, true);

            if (! is_array($payload)) {
                continue;
            }

            $commandName = $payload['data']['commandName'] ?? ($payload['displayName'] ?? null);
            $command = $payload['data']['command'] ?? null;

            if ($commandName !== ProcessReportExport::class || ! is_string($command)) {
                continue;
            }

            if (preg_match('/"exportId";i:(\d+);/', $command, $matches) === 1 && in_array((int) $matches[1], $exportIds, true)) {
                $jobIdsToDelete[] = (int) $job->id;
            }
        }

        if ($jobIdsToDelete !== []) {
            DB::connection($connectionName)
                ->table($table)
                ->whereIn('id', $jobIdsToDelete)
                ->whereNull('reserved_at')
                ->delete();
        }
    }
}
