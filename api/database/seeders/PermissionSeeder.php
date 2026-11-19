<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [];

        foreach (Permission::ALL as $code => $description) {
            $rows[] = ['code' => $code, 'description' => $description];
        }

        Permission::query()->upsert($rows, ['code'], ['description']);
    }
}
