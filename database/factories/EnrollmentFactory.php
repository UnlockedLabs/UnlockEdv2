<?php

// database/factories/EnrollmentFactory.php

namespace Database\Factories;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\ProviderPlatform;
use App\Models\ProviderUserMapping;
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
        $provider = ProviderPlatform::factory()->createOne();
        $user = User::factory()->createOne();
        ProviderUserMapping::factory()->forUser($user->id)->forProvider($provider->id)->createOne();
        $course = Course::factory()->forProviderPlatform($provider->id)->createOne();

        return [
            'user_id' => $user->id,
            'course_id' => $course->id,
            'external_enrollment_id' => $this->faker->unique()->numberBetween(1, 1000),
            'enrollment_state' => $this->faker->randomElement(['active', 'inactive', 'completed']),
            'external_start_at' => $startAt,
            'external_end_at' => $endAt,
            'external_link_url' => $this->faker->url,
        ];
    }

    // Create an enrollment for a specific user and provider
    public function forUser(int $user_id): static
    {
        return $this->state(fn (array $attributes) => [
            'user_id' => $user_id,
        ]);
    }

    public function forCourse(string $id): static
    {
        return $this->state(fn (array $attributes) => [
            'course_id' => $id,
        ]);
    }
}
