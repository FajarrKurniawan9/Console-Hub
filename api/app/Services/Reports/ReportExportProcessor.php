<?php

namespace App\Services\Reports;

use App\Connectors\Exceptions\ConsoleException;
use App\Models\ReportExport;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

class ReportExportProcessor
{
    public const DISK = 'local';

    public const STUCK_MINUTES = 15;

    public function __construct(
        private ReportDataExtractor $extractor,
        private ReportFileWriter $writer,
    ) {}

    /**
     * Atomically claim a pending export ticket and generate its output file.
     * Returns false when the ticket does not exist or was already claimed by another worker.
     */
    public function claimAndProcess(int $exportId): bool
    {
        $claimed = ReportExport::query()
            ->whereKey($exportId)
            ->where('status', ReportExport::STATUS_PENDING)
            ->update([
                'status' => ReportExport::STATUS_PROCESSING,
                'started_at' => now(),
                'error_message' => null,
            ]);

        if ($claimed === 0) {
            return false;
        }

        $export = ReportExport::query()->find($exportId);

        if ($export === null) {
            return false;
        }

        $path = sprintf(
            'exports/%s/export-%d-%s.%s',
            now()->utc()->format('Y/m'),
            $export->id,
            $export->type,
            $export->format,
        );

        try {
            $columns = $this->extractor->columnsFor($export->type);
            $rows = $this->extractor->extract($export->type, $export->filters ?? []);
            $rowCount = $this->writer->write(self::DISK, $path, $export->format, $columns, $rows, $export->name);

            $export->update([
                'status' => ReportExport::STATUS_COMPLETED,
                'file_path' => $path,
                'row_count' => $rowCount,
                'error_message' => null,
                'completed_at' => now(),
            ]);
        } catch (Throwable $e) {
            Storage::disk(self::DISK)->delete($path);

            $message = $e instanceof ConsoleException
                ? $e->userMessage()
                : 'Terjadi kesalahan saat memproses ekspor laporan. Silakan coba lagi.';

            Log::error('Report export failed', [
                'export_id' => $export->id,
                'type' => $export->type,
                'format' => $export->format,
                'exception' => $e::class,
            ]);

            $export->update([
                'status' => ReportExport::STATUS_FAILED,
                'file_path' => null,
                'error_message' => $message,
                'completed_at' => now(),
            ]);
        }

        return true;
    }

    /**
     * Process pending tickets in FIFO order (scheduler fallback sweep).
     */
    public function processPending(int $limit = 20): int
    {
        $ids = ReportExport::query()
            ->where('status', ReportExport::STATUS_PENDING)
            ->orderBy('id')
            ->limit($limit)
            ->pluck('id');

        $processed = 0;

        foreach ($ids as $id) {
            if ($this->claimAndProcess((int) $id)) {
                $processed++;
            }
        }

        return $processed;
    }

    /**
     * Mark tickets stuck in processing beyond the timeout threshold as failed.
     */
    public function failStuck(int $minutes = self::STUCK_MINUTES): int
    {
        return ReportExport::query()
            ->where('status', ReportExport::STATUS_PROCESSING)
            ->whereNotNull('started_at')
            ->where('started_at', '<', now()->subMinutes($minutes))
            ->update([
                'status' => ReportExport::STATUS_FAILED,
                'file_path' => null,
                'error_message' => 'Proses ekspor melebihi batas waktu. Silakan buat ulang tiket ekspor.',
                'completed_at' => now(),
            ]);
    }
}
