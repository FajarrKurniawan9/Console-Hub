<?php

namespace Database\Seeders;

use App\Models\CodeCounter;
use Illuminate\Database\Seeder;

/**
 * Creates missing counters at zero; never resets a counter that is already running.
 */
class CodeCounterSeeder extends Seeder
{
    public function run(): void
    {
        $keys = ['employee', 'division', 'item-BB', 'item-BJ', 'order-'.now()->year];

        CodeCounter::query()->insertOrIgnore(array_map(fn (string $key) => ['counter_key' => $key, 'last_value' => 0], $keys));
    }
}
