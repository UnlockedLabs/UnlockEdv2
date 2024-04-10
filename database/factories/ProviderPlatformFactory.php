<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\ProviderPlatform;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\ProviderPlatform>
 */
class ProviderPlatformFactory extends Factory
{
    protected $model = ProviderPlatform::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'type' => fake()->randomElement(['canvas_cloud', 'canvas_oss']),
            'name' => fake()->name(),
            'description' => fake()->sentence($nbWords = 3),
            'icon_url' => fake()->imageUrl(),
            'account_id' => fake()->randomNumber($nbDigits = 9),
            'access_key' => Str::random(16),
            'base_url' => fake()->url(),
            'state' => fake()->randomElement(['enabled', 'disabled', 'archived']),

        ];
    }
}
