<?php

// database/factories/EnrollmentFactory.php

namespace Database\Factories;

use App\Models\Enrollment;
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
            'user_id' => $this->faker->numberBetween(1, 1000000),
            'course_id' => $this->faker->numberBetween(1, 1000000),
            'provider_id' => $this->faker->word,
            'enrollment_state' => $this->faker->randomElement(['active', 'inactive', 'completed']),
            'links' => ['link1' => $this->faker->url, 'link2' => $this->faker->url],
            'provider_start_at' => $startAt,
            'provider_end_at' => $this->faker->$endAt,
        ];
    }
}
