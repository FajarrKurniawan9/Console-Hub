<?php

namespace App\Console\Commands;

use App\Models\Console;
use App\Services\HealthChecker;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('consoles:check')]
#[Description('Panggil /health tiap console aktif dan simpan hasilnya')]
class ConsolesCheck extends Command
{
    public function handle(HealthChecker $checker): int
    {
        Console::query()->where('is_active', true)->orderBy('id')->each(function (Console $console) use ($checker) {
            $result = $checker->check($console);
            $this->line("{$console->slug}: {$result['status']} ".($result['latency_ms'] !== null ? "({$result['latency_ms']} ms)" : "— {$result['message']}"));
        });

        return self::SUCCESS;
    }
}
