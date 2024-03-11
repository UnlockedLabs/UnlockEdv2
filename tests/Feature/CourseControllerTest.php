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

    public array $structure = [
        'data' => [
            'id',
            'external_course_name',
            'external_course_code',
            'description',
            'provider_platform_id',
            'img_url',
            'created_at',
            'updated_at',
        ],
    ];

    public array $list_structure = [
        'data' => [
            '*' => [
                'id',
                'external_course_name',
                'external_course_code',
                'description',
                'provider_platform_id',
                'img_url',
                'created_at',
                'updated_at',
            ],
        ],
    ];

    public function testCoursesIndex()
    {
        $this->seed(TestSeeder::class);
        $user = \App\Models\User::factory()->admin()->create();
        $response = $this->actingAs($user)->get($this->uri);
        $response->assertStatus(200);
        $this->assertCount(10, $response['data']);
        $response->assertJsonIsArray('data');
        $response->assertJsonStructure($this->list_structure);
    }

    // this tests the show method in the controller
    public function testGetCourse()
    {
        $this->seed(TestSeeder::class);
        $course = Course::inRandomOrder()->first();
        $user = \App\Models\User::inRandomOrder()->first();
        $response = $this->actingAs($user)->get($this->uri.'/'.$course->id);

        $response->assertStatus(200);

        $response->assertJsonStructure($this->structure);
    }

    // this test the update method in the controller
    public function testUpdateCourse()
    {
        $this->seed(TestSeeder::class);
        $user = \App\Models\User::factory()->admin()->create();
        $course = Course::factory(1)->create();
        $response = $this->actingAs($user)->patch($this->uri.'/'.$course[0]->id, ['external_course_name' => 'TestUpdate']);
        $response->assertStatus(200);
        $this->assertTrue($response['data']['external_course_name'] == 'TestUpdate');
    }

    // this test the update method in the controller
    public function testUpdateCourseUnauthorized()
    {
        $user = \App\Models\User::factory()->create();
        $course = Course::factory(1)->create();
        $response = $this->actingAs($user)->patch($this->uri.'/'.$course[0]->id, ['external_course_name' => 'TestUpdate']);
        $response->assertStatus(403);
    }

    // this tests the destroy method in the controller
    public function testDeleteCourse()
    {
        $this->seed(TestSeeder::class);
        $user = \App\Models\User::factory()->admin()->create();
        $course = Course::inRandomOrder()->first();
        $response = $this->actingAs($user)->delete($this->uri.'/'.$course->id);
        $response->assertStatus(204);
    }

    // this tests the destroy method in the controller
    public function testDeleteCourseUnauthorized()
    {
        $this->seed(TestSeeder::class);
        $user = \App\Models\User::factory()->create();
        $course = Course::inRandomOrder()->first();
        $response = $this->actingAs($user)->delete($this->uri.'/'.$course->id);
        $response->assertStatus(403);
    }
}
