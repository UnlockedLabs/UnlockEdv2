<?php

namespace Tests\Feature;

use App\Models\Course;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CourseControllerTest extends TestCase
{
    use RefreshDatabase;

    public string $uri = '/api/v1/courses';

    // this tests the store method in the controller
    public function testCoursesAreCreated()
    {
        Course::factory(10)->create();
        $user = \App\Models\User::factory()->admin()->create();

        $response = $this->actingAs($user)->get($this->uri);

        $response->assertStatus(200);

        $this->assertCount(10, $response['data']);
        $response->assertJsonIsArray('data');
        $response->assertJsonStructure([
            'data' => [
                '*' => [
                    'id',
                    'provider_course_name',
                    'created_at',
                    'updated_at',
                ],
            ],
        ]);
    }

    // this tests the show method in the controller
    public function testGetCourses()
    {
        $course = Course::factory(1)->create();
        $user = \App\Models\User::factory()->create();
        $response = $this->actingAs($user)->get($this->uri.'/'.$course[0]->id);

        $response->assertStatus(200);

        $jsonResponse = $response->json();

        // Assert that the response contains the category
        foreach ($jsonResponse as $key => $value) {
            // Skip keys 'created_at' and 'updated_at'
            if (in_array($key, ['created_at', 'updated_at'])) {
                continue;
            }
            assert($value, $course[0]->$key);
        }
    }

    // this test the update method in the controller
    public function testUpdateCourse()
    {
        $user = \App\Models\User::factory()->admin()->create();
        $course = Course::factory(1)->create();
        $response = $this->actingAs($user)->patch($this->uri.'/'.$course[0]->id, ['provider_course_name' => 'TestUpdate']);
        $response->assertStatus(200);
        assert($response['data']['provider_course_name'] == 'TestNameUpdate');
    }

    // this tests the destroy method in the controller
    public function testDeleteCourse()
    {
        $user = \App\Models\User::factory()->admin()->create();
        $course = Course::factory(1)->create();
        $response = $this->actingAs($user)->delete($this->uri.'/'.$course[0]->id);
        $response->assertStatus(204);
    }

    // this tests the destroy method in the controller
    public function testDeleteCourseUnauthorized()
    {
        $user = \App\Models\User::factory()->create();
        $course = Course::factory(1)->create();
        $response = $this->actingAs($user)->delete($this->uri.'/'.$course[0]->id);
        $response->assertStatus(403);
    }
}
