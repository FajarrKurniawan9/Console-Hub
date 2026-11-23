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
        Role::query()->where('code', Role::MANAJER_GUDANG)->firstOrFail()->permissions()->syncWithoutDetaching($ids->only(Permission::MANAJER_GUDANG_DEFAULTS)->values()->all());
        Role::query()->where('code', Role::STAFF_PRODUKSI)->firstOrFail()->permissions()->syncWithoutDetaching($ids->only(Permission::STAFF_PRODUKSI_DEFAULTS)->values()->all());
        Role::query()->where('code', Role::STAFF_HR)->firstOrFail()->permissions()->syncWithoutDetaching($ids->only(Permission::STAFF_HR_DEFAULTS)->values()->all());
        Role::query()->where('code', Role::AUDITOR)->firstOrFail()->permissions()->syncWithoutDetaching($ids->only(Permission::AUDITOR_DEFAULTS)->values()->all());
    }
}
