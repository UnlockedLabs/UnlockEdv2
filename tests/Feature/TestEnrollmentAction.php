<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\User;
use App\Services\CanvasServices;
use Database\Seeders\CoursesEnvSeeder;
use Database\Seeders\DatabaseSeeder;
use Tests\TestCase;

class TestEnrollmentAction extends TestCase
{
    /**
     * A basic feature test example.
     */
    public function test_example(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->seed(CoursesEnvSeeder::class);
        // The env variable will put Chris as user 2.
        // Chris is enrolled in all the courses on the Canvas instance
        // with provider_id = 1
        $proc = [
            'provider_platform_id' => 1,
            'user_id' => 2,
        ];
        $user = User::findOrFail(2);
        $extern_id = $user->externalIdFor(1);
        $cs = CanvasServices::byProviderId(1);
        $enrollments = $cs->listEnrollmentsForUser(2);
        foreach ($enrollments as $enrollment) {
            if ($course = Course::findOrFail($enrollment->course_id)) {
                $this->assertEquals($course->external_resource_id, $enrollment->course_id);
                $this->assertEquals($course->external_course_name, $enrollment->course_name);
                $this->assertEquals($course->external_course_code, $enrollment->course_code);
                $this->assertEquals($course->img_url, $enrollment->course_image);
            }
            $response = $this->postJson('actions/store-user-enrollments', $proc);
            $response->assertStatus(201);
            $data = $response->json();
            echo $data;
        }
    }
}
