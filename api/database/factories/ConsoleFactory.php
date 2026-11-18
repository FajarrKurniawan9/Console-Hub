<?php

namespace Database\Factories;

use App\Models\Console;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Console>
 */
class ConsoleFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $slug = fake()->unique()->slug(2);

        return [
            'slug' => $slug,
            'name' => 'Web '.ucfirst($slug),
            'base_url' => "http://{$slug}.test",
            'auth_type' => 'api_key',
            'credentials' => ['header' => 'X-API-Key', 'key' => 'test-api-key-'.fake()->uuid()],
            'config' => ['health' => ['path' => '/health', 'requires_auth' => false]],
            'timezone' => 'UTC',
            'is_active' => true,
            'status' => 'unknown',
        ];
    }

    public function bearer(int $ttlSeconds = 300): static
    {
        return $this->state(fn (array $attributes) => [
            'auth_type' => 'bearer',
            'credentials' => ['username' => 'hub', 'password' => 'bearer-secret-pass'],
            'config' => [
                'health' => ['path' => '/health', 'requires_auth' => false],
                'auth' => ['login' => [
                    'path' => '/auth/login',
                    'method' => 'POST',
                    'body' => ['username' => '{{secret.username}}', 'password' => '{{secret.password}}'],
                    'token_path' => 'access_token',
                    'ttl_seconds' => $ttlSeconds,
                ]],
            ],
        ]);
    }

    public function basic(): static
    {
        return $this->state(fn (array $attributes) => [
            'auth_type' => 'basic',
            'credentials' => ['username' => 'hub', 'password' => 'basic-secret-pass'],
        ]);
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => ['is_active' => false]);
    }
}
