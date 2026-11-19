<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * The first Admin IT and User accounts from SEED_* in .env. Passwords never appear in code or output.
 */
class UserSeeder extends Seeder
{
    public function run(): void
    {
        /** @var array<string, array{name: string, email: string, password: string|null, role: string}> $accounts */
        $accounts = config('consolehub.seed_users');
        $roles = Role::query()->pluck('id', 'code');

        foreach ($accounts as $label => $account) {
            $env = 'SEED_'.strtoupper($label).'_PASSWORD';
            $password = $account['password'];

            if (! is_string($password) || $password === '') {
                throw new RuntimeException("{$env} kosong. Isi di .env sebelum menjalankan seeder.");
            }

            if (app()->isProduction() && mb_strlen($password) < 12) {
                throw new RuntimeException("{$env} terlalu pendek untuk produksi (minimal 12 karakter).");
            }

            $user = User::query()->firstOrNew(['email' => $account['email']]);
            $user->fill(['name' => $user->exists ? $user->name : $account['name'], 'role_id' => $roles[$account['role']], 'is_active' => true]);

            // Keep a password the person already changed; set it only for a new account.
            if (! $user->exists) {
                $user->password = $password;
            }

            $user->save();
        }
    }
}
