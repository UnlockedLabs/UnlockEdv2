<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\UserCourseActivity;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\UserCourseActivity>
 */
class UserCourseActivityFactory extends Factory
{
    protected $model = UserCourseActivity::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => 1,
            'enrollment_id' => 1,
            'external_has_activity' => $this->faker->boolean,
            'external_total_activity_time' => $this->faker->numberBetween(1000, 100000),
        ];
    }

    /**
     * Return an instance with a specified date field.
     */
    public function forDate($date): static
    {
        return $this->state(fn (array $attributes) => [
            'date' => $date,
        ]);
    }

    /**
     * Return an instance with a specified user_id field.
     **/
    public function forUser(int $user_id): static
    {
        return $this->state(fn (array $attributes) => [
            'user_id' => $user_id,
        ]);
    }

    /**
     * Return an instance with a specified enrollment_id field.
     **/
    public function forEnrollment(int $enrollment_id): static
    {
        return $this->state(fn (array $attributes) => [
            'enrollment_id' => $enrollment_id,
        ]);
    }
}
