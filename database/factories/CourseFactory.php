<?php

namespace Database\Factories;

use App\Models\ProviderPlatform;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Courses>
 */
class CourseFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'provider_resource_id' => $this->faker->unique()->numberBetween(1, 1000000), // Example: Generate a unique ID between 1 and 100,
            'provider_course_name' => $this->faker->word,
            'provider_platform_id' => ProviderPlatform::factory()->createOne()->id,
            'description' => $this->faker->paragraph($nbSentences = 3, $variableNbSentences = true),
            'provider_start_at' => $this->faker->date,
            'provider_end_at' => $this->faker->date,
            'img_url' => $this->faker->imageUrl($width = 640, $height = 480),
        ];
    }

    public function forProviderPlatform(int $id): static
    {
        return $this->state(fn (array $attributes) => [
            'provider_platform_id' => $id,
        ]);
    }

    public function withResourceId(int $id): static
    {
        return $this->state(fn (array $attributes) => [
            'provider_resource_id' => $id,
        ]);
    }
}
