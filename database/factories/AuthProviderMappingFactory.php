<?php

namespace Database\Factories;

use App\Models\ProviderPlatform;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\AuthProviderMapping>
 */
class AuthProviderMappingFactory extends Factory
{
    protected $model = \App\Models\AuthProviderMapping::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'provider_platform_id' => ProviderPlatform::factory()->createOne()->id,
            'authentication_provider_id' => $this->faker->numberBetween(1, 10),
            'authentication_type' => 'openid_connect',
        ];
    }
}
