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
            'is_owner_of' => match ($slug) {
                'hr' => ['divisions', 'employees'],
                'gudang' => ['items'],
                default => ['orders'],
            },
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }
}
