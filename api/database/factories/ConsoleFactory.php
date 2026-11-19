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
        $slug = fake()->unique()->randomElement(['hr', 'gudang', 'produksi']);

        return [
            'slug' => $slug,
            'name' => ucfirst($slug),
            'base_url' => "http://{$slug}.test",
            'auth_type' => 'api_key',
            'service_key' => 'test-key-'.$slug,
            'is_active' => true,
            // Follows the final slug, also when a test overrides it.
            'is_owner_of' => fn (array $attributes) => match ($attributes['slug']) {
                'hr' => ['divisions', 'employees'],
                'gudang' => ['items'],
                'produksi' => ['orders'],
                default => [],
            },
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }
}
