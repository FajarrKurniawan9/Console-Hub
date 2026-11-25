<?php

namespace App\Console\Commands;

use App\Services\Reports\ReportExportProcessor;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('reports:process {--limit=20 : Jumlah maksimal tiket pending yang diproses per siklus}')]
#[Description('Jalankan jadwal ekspor jatuh tempo, proses antrean FIFO, dan pulihkan tiket yang macet')]
class ReportsProcess extends Command
{
    public function handle(ReportExportProcessor $processor): int
    {
        $triggered = $processor->processDueScheduled();
        $stuck = $processor->failStuck();
        $limit = max(1, (int) $this->option('limit'));
        $processed = $processor->processPending($limit);

        $this->info("Jadwal dipicu: {$triggered}, ekspor diproses: {$processed}, tiket macet ditandai gagal: {$stuck}.");

        return self::SUCCESS;
    }
}
