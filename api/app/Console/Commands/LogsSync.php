<?php

namespace App\Console\Commands;

use App\Models\Console;
use App\Services\LogSync;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('logs:sync {console? : Slug console; kosong = semua console aktif}')]
#[Description('Tarik log dari API console dan simpan dalam format seragam')]
class LogsSync extends Command
{
    public function handle(LogSync $sync): int
    {
        $slug = $this->argument('console');
        $consoles = Console::query()
            ->when($slug, fn ($q) => $q->where('slug', $slug), fn ($q) => $q->where('is_active', true))
            ->orderBy('name')
            ->get();

        if ($slug && $consoles->isEmpty()) {
            $this->error("Console {$slug} tidak ditemukan.");

            return self::FAILURE;
        }

        foreach ($consoles as $console) {
            $result = $sync->syncConsole($console);

            $result['status'] === 'ok'
                ? $this->info("{$console->slug}: {$result['inserted']} entri baru")
                : $this->warn("{$console->slug}: gagal — {$result['error']}");
        }

        return self::SUCCESS;
    }
}
