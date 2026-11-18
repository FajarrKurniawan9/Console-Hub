<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $users = [
            ['name' => 'Admin Hub', 'email' => 'admin@consolehub.test', 'is_admin' => true, 'password_env' => 'SEED_ADMIN_PASSWORD'],
            ['name' => 'Operator Hub', 'email' => 'operator@consolehub.test', 'is_admin' => false, 'password_env' => 'SEED_USER_PASSWORD'],
        ];

        foreach ($users as $user) {
            $password = env($user['password_env']);

            if (! is_string($password) || $password === '') {
                throw new RuntimeException("{$user['password_env']} kosong. Isi di .env sebelum menjalankan seeder.");
            }

            User::query()->updateOrCreate(
                ['email' => $user['email']],
                ['name' => $user['name'], 'is_admin' => $user['is_admin'], 'password' => $password],
            );
        }
    }
}
