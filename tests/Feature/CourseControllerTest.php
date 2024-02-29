<?php

namespace Tests\Feature;

use App\Models\Course;
use Database\Seeders\TestSeeder;
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
        $this->seed(TestSeeder::class);
        $course = Course::factory()->createOne();
        $user = \App\Models\User::factory()->create();
        $response = $this->actingAs($user)->get($this->uri.'/'.$course->id);

        $response->assertStatus(200);

        $response->assertJsonStructure([
            'data' => [
                'id',
                'provider_course_name',
                'created_at',
                'updated_at',
            ],
        ]);
    }

    // this test the update method in the controller
    public function testUpdateCourse()
    {
        $user = \App\Models\User::factory()->admin()->create();
        $course = Course::factory(1)->create();
        $response = $this->actingAs($user)->patch($this->uri.'/'.$course[0]->id, ['provider_course_name' => 'TestUpdate']);
        $response->assertStatus(200);
        $this->assertTrue($response['data']['provider_course_name'] == 'TestUpdate');
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
