<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

/**
 * Upserts every code in Permission::ALL and drops codes that no longer exist (with their grants).
 */
class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [];

        foreach (Permission::ALL as $code => $description) {
            $rows[] = ['code' => $code, 'description' => $description];
        }

        Permission::query()->upsert($rows, ['code'], ['description']);
        Permission::query()->whereNotIn('code', array_keys(Permission::ALL))->delete();
    }
}
