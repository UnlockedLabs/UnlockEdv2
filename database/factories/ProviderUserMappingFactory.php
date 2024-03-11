<?php

namespace Database\Factories;

use App\Enums\AuthProviderStatus;
use App\Models\ProviderPlatform;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\ProviderUserMapping>
 */
class ProviderUserMappingFactory extends Factory
{
    protected $model = \App\Models\ProviderUserMapping::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory()->create(),
            'provider_platform_id' => ProviderPlatform::factory()->create(),
            'external_user_id' => $this->faker->numberBetween(1, 1000),
            'external_username' => $this->faker->word,
            'authentication_provider_status' => AuthProviderStatus::OPENID_CONNECT,
        ];
    }

    public function forUser(int $user_id): static
    {
        return $this->state(fn (array $attributes) => ['user_id' => $user_id]);
    }

    public function forProvider(int $provider_id): static
    {
        return $this->state(fn (array $attributes) => ['provider_platform_id' => $provider_id]);
    }
}
