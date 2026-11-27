<?php

namespace App\Console\Commands;

use App\Services\Imports\ImportExecutionService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('imports:process')]
#[Description('Pulihkan tiket impor yang macet dan kirim ulang antrean impor yang tertunda')]
class ImportsProcess extends Command
{
    public function handle(ImportExecutionService $service): int
    {
        $result = $service->processScheduledSweep();

        $this->info("Tiket macet ditandai gagal: {$result['stuck_failed']}, tiket queued disweep: {$result['queued_dispatched']}.");

        return self::SUCCESS;
    }
}
