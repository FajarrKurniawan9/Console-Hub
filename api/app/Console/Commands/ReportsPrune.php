<?php

namespace App\Console\Commands;

use App\Models\ReportExport;
use App\Services\Reports\ReportExportProcessor;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

#[Signature('reports:prune {--days=7 : Hapus file dan riwayat ekspor lebih lama dari N hari}')]
#[Description('Hapus file ekspor dan riwayat tiket yang sudah kedaluwarsa')]
class ReportsPrune extends Command
{
    public function handle(): int
    {
        $days = max(1, (int) $this->option('days'));
        $cutoff = now()->subDays($days);

        $deletedFiles = 0;
        $deletedRecords = 0;

        ReportExport::query()
            ->where('created_at', '<', $cutoff)
            ->orderBy('id')
            ->chunkById(100, function ($exports) use (&$deletedFiles, &$deletedRecords): void {
                foreach ($exports as $export) {
                    /** @var ReportExport $export */
                    if ($export->file_path !== null && Storage::disk(ReportExportProcessor::DISK)->exists($export->file_path)) {
                        Storage::disk(ReportExportProcessor::DISK)->delete($export->file_path);
                        $deletedFiles++;
                    }

                    $export->delete();
                    $deletedRecords++;
                }
            });

        $this->info("Dihapus: {$deletedRecords} riwayat ekspor dan {$deletedFiles} file.");

        return self::SUCCESS;
    }
}
