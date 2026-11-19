<?php

namespace Database\Seeders;

use App\Models\Console;
use Illuminate\Database\Seeder;

/**
 * The three consoles from CONSOLE_* in .env. A console without a key is created inactive.
 */
class ConsoleSeeder extends Seeder
{
    public function run(): void
    {
        /** @var array<string, array{name: string, base_url: string, service_key: string|null, is_owner_of: list<string>}> $consoles */
        $consoles = config('consolehub.consoles');

        foreach ($consoles as $slug => $console) {
            $hasKey = is_string($console['service_key']) && $console['service_key'] !== '';

            if (! $hasKey) {
                $this->command?->warn('CONSOLE_'.strtoupper($slug)."_KEY kosong: console {$slug} dibuat nonaktif.");
            }

            Console::query()->updateOrCreate(['slug' => $slug], [
                'name' => $console['name'],
                'base_url' => $console['base_url'],
                'auth_type' => 'api_key',
                'service_key' => $hasKey ? $console['service_key'] : null,
                'is_active' => $hasKey,
                'is_owner_of' => $console['is_owner_of'],
            ]);
        }
    }
}
