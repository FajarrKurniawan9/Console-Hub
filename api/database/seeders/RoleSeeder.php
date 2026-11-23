<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        Role::query()->upsert([
            ['code' => Role::ADMIN_IT, 'name' => 'Admin IT'],
            ['code' => Role::USER, 'name' => 'User'],
            ['code' => Role::MANAJER_GUDANG, 'name' => 'Manajer Gudang'],
            ['code' => Role::STAFF_PRODUKSI, 'name' => 'Staff Produksi'],
            ['code' => Role::STAFF_HR, 'name' => 'Staff HR'],
            ['code' => Role::AUDITOR, 'name' => 'Auditor'],
        ], ['code'], ['name']);
    }
}
