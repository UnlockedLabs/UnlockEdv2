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
            'external_user_id' => $this->faker->numberBetween(1, 10),
            'external_username' => $this->faker->word,
            'authentication_provider_status' => AuthProviderStatus::OPENID_CONNECT,
        ];
    }
}
