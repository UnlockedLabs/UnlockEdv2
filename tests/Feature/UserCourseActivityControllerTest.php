<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\User;
use Database\Seeders\TestSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserCourseActivityControllerTest extends TestCase
{
    use RefreshDatabase;

    /**
     * A basic feature test example.
     */
    public function test_get_all_course_activity_for_user(): void
    {
        $this->refreshDatabase();

        $this->seed(TestSeeder::class);
        $admin = User::factory()->admin()->createOne();
        $user = User::inRandomOrder()->first();
        $id = $user->id;
        $response = $this->actingAs($admin)->get("api/v1/users/$id/course-activity");
        $response->assertSuccessful();
        $response->assertJsonStructure([
            'data' => [
                '*' => [
                    'user_id',
                    'username',
                    'course_name',
                    'enrollment_id',
                    'total_time',
                    'has_activity',
                    'date',
                    'provider_platform_id',
                ],
            ],
        ]);
        $response->assertStatus(200);
    }

    public function test_get_all_course_activity_for_user_auth(): void
    {
        $this->refreshDatabase();

        $this->seed(TestSeeder::class);
        $user = User::inRandomOrder()->first();
        $id = $user->id;
        $response = $this->actingAs($user)->get("api/v1/users/$id/course-activity");
        $response->assertSuccessful();
        $response->assertJsonStructure([
            'data' => [
                '*' => [
                    'user_id',
                    'username',
                    'course_name',
                    'enrollment_id',
                    'total_time',
                    'has_activity',
                    'date',
                    'provider_platform_id',
                ],
            ],
        ]);
        $response->assertStatus(200);
    }

    public function test_get_all_course_activity_for_user_and_course(): void
    {
        $this->seed(TestSeeder::class);
        $user = User::inRandomOrder()->first();
        $id = $user->id;
        $courseId = Course::inRandomOrder()->first()->id;
        $response = $this->actingAs($user)->get("api/v1/users/$id/course-activity/$courseId");
        $response->assertSuccessful();
        $response->assertJsonStructure([
            'data' => [
                '*' => [
                    'user_id',
                    'username',
                    'course_name',
                    'enrollment_id',
                    'total_time',
                    'has_activity',
                    'date',
                    'provider_platform_id',
                ],
            ],
        ]);
    }
}
