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
        ], ['code'], ['name']);
    }
}
