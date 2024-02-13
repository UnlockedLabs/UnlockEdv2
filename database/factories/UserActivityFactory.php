<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\UserActivity>
 */
class UserActivityFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'browser_name' => $this->faker->word,
            'platform' => $this->faker->word,
            'device' => $this->faker->word,
            'ip' => $this->faker->ipv4,
            'clicked_url' => $this->faker->url,
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }

    // Create for a specific user
    public function forUser(string $id): static
    {
        return $this->state(fn (array $attributes) => [
            'user_id' => $id,
        ]);
    }
}
