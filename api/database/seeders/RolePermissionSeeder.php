<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * Adds the default permissions of each role. Never removes a permission an admin granted later.
 */
class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $ids = Permission::query()->pluck('id', 'code');

        Role::query()->where('code', Role::ADMIN_IT)->firstOrFail()->permissions()->syncWithoutDetaching($ids->values()->all());
        Role::query()->where('code', Role::USER)->firstOrFail()->permissions()->syncWithoutDetaching($ids->only(Permission::USER_DEFAULTS)->values()->all());
    }
}
