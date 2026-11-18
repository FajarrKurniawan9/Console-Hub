<?php

namespace App\Console\Commands;

use App\Models\ConsoleHealthCheck;
use App\Models\LogEntry;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('logs:prune')]
#[Description('Hapus log lebih dari 30 hari dan health check lebih dari 7 hari')]
class LogsPrune extends Command
{
    public function handle(): int
    {
        $logs = LogEntry::query()->where('occurred_at', '<', now()->subDays(30))->delete();
        $checks = ConsoleHealthCheck::query()->where('checked_at', '<', now()->subDays(7))->delete();

        $this->info("Dihapus: {$logs} log, {$checks} health check.");

        return self::SUCCESS;
    }
}
