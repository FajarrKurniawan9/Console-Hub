<?php

namespace Database\Seeders;

use App\Models\Console;
use Illuminate\Database\Seeder;
use RuntimeException;

class ConsoleSeeder extends Seeder
{
    public function run(): void
    {
        $consoles = json_decode((string) file_get_contents(database_path('seeders/data/consoles.json')), true, flags: JSON_THROW_ON_ERROR);

        foreach ($consoles as $console) {
            $console = $this->fillEnv($console);

            Console::query()->updateOrCreate(['slug' => $console['slug']], $console);
        }
    }

    /**
     * Replace "{{env NAME}}" placeholders with environment values; fail loudly when one is empty.
     */
    private function fillEnv(mixed $value): mixed
    {
        if (is_array($value)) {
            return array_map(fn ($item) => $this->fillEnv($item), $value);
        }

        if (! is_string($value) || ! preg_match('/^\{\{env (\w+)\}\}$/', $value, $match)) {
            return $value;
        }

        $resolved = env($match[1]);

        if (! is_string($resolved) || $resolved === '') {
            throw new RuntimeException("{$match[1]} kosong. Isi di .env sebelum menjalankan seeder.");
        }

        return $resolved;
    }
}
