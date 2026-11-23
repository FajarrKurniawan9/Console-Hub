<?php

namespace Database\Seeders;

use App\Support\DatabaseGuard;
use Illuminate\Database\Seeder;

/**
 * Portal seed (brief v3 section 13.1). Idempotent: safe to run again.
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->runningUnitTests()) {
            DatabaseGuard::assert();
        }

        $this->call([
            RoleSeeder::class,
            PermissionSeeder::class,
            RolePermissionSeeder::class,
            ConsoleSeeder::class,
            UserSeeder::class,
            DashboardSeeder::class,
            LogSeeder::class,
        ]);
    }
}
