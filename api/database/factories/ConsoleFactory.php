<?php

namespace Database\Factories;

use App\Models\Console;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Console>
 */
class ConsoleFactory extends Factory
{
    public const RESOURCES = ['gudang' => 'items', 'produksi' => 'productions', 'hr' => 'people'];

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $slug = fake()->unique()->randomElement(['hr', 'gudang', 'produksi']);

        return [
            'slug' => $slug,
            'name' => fn (array $attributes) => ucfirst($attributes['slug']),
            'base_url' => "http://{$slug}.test",
            'auth_type' => 'api_key',
            'service_key' => 'test-key-'.$slug,
            'is_active' => true,
            // Follows the final slug, also when a test overrides it.
            'resource' => fn (array $attributes) => self::RESOURCES[$attributes['slug']] ?? 'items',
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }
}
