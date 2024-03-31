<?php

declare(strict_types=1);

namespace Database\Factories;

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
            'external_resource_id' => $this->faker->unique()->numberBetween(1, 1000000), // Example: Generate a unique ID between 1 and 100,
            'external_course_name' => $this->faker->word,
            'external_course_code' => $this->faker->word, // Example: 'CS-101'
            'provider_platform_id' => $this->faker->randomDigitNotNull,
            'description' => substr($this->faker->paragraph($nbSentences = 3, $variableNbSentences = true), 0, 254),
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
            'external_resource_id' => $id,
        ]);
    }
}
