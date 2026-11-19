<?php

namespace Database\Factories;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected static ?string $password;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'password' => static::$password ??= Hash::make('password'),
            'role_id' => fn () => self::role(Role::USER)->id,
            'is_active' => true,
        ];
    }

    public function admin(): static
    {
        return $this->state(fn () => ['role_id' => self::role(Role::ADMIN_IT)->id]);
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }

    /**
     * The seeded role with its default permissions, created on first use in tests.
     */
    public static function role(string $code): Role
    {
        $role = Role::query()->firstOrCreate(['code' => $code], ['name' => $code === Role::ADMIN_IT ? 'Admin IT' : 'User']);

        if ($role->wasRecentlyCreated) {
            $codes = $code === Role::ADMIN_IT ? array_keys(Permission::ALL) : Permission::USER_DEFAULTS;
            $ids = collect($codes)->map(fn (string $c) => Permission::query()->firstOrCreate(['code' => $c], ['description' => Permission::ALL[$c]])->id);
            $role->permissions()->sync($ids->all());
        }

        return $role;
    }
}
