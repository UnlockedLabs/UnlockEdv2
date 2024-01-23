<?php

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
            //
            'provider_resource_id' => $this->faker->unique()->numberBetween(1, 1000000), // Example: Generate a unique ID between 1 and 100,
            'provider_course_name' => $this->faker->word,
            'provider_start_at' => $this->faker->date,
            'provider_end_at' => $this->faker->date,
        ];
    }
}
