<?php

// database/factories/EnrollmentFactory.php

namespace Database\Factories;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\ProviderPlatform;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class EnrollmentFactory extends Factory
{
    protected $model = Enrollment::class;

    public function definition()
    {
        $startAt = $this->faker->dateTimeThisMonth();
        $endAt = $this->faker->optional(0.5) // 50% chance of being null
            ->dateTimeInInterval($startAt, '+120 days');

        return [
            'user_id' => User::factory(),
            'course_id' => Course::factory()->createOne()->id,
            'provider_platform_id' => ProviderPlatform::factory()->create()->id,
            'provider_user_id' => $this->faker->numberBetween(1, 1000000),
            'provider_course_id' => $this->faker->numberBetween(1, 1000000),
            'provider_enrollment_id' => $this->faker->unique()->numberBetween(1, 1000),
            'enrollment_state' => $this->faker->randomElement(['active', 'inactive', 'completed']),
            'links' => json_encode(['link1' => $this->faker->url, 'link2' => $this->faker->url]),
            'provider_start_at' => $startAt,
            'provider_end_at' => $endAt,
        ];
    }

    // Create an enrollment for a specific user
    public function forUser(string $id): static
    {
        return $this->state(fn (array $attributes) => [
            'user_id' => $id,
        ]);
    }

    public function forCourse(string $id): static
    {
        return $this->state(fn (array $attributes) => [
            'course_id' => $id,
        ]);
    }
}
