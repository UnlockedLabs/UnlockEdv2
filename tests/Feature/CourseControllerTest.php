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
        // Create 10 categories using the factory
        $courses = Course::factory(10)->create();

        // Assert that 10 categories were created
        $this->assertCount(10, $courses);
    }

    // tests the index method in the controller
    public function testCoursesIndexReturnsJson()
    {
        // Create 10 courses using the factory
        Course::factory(2)->create();

        // Make a GET request to the index method
        $response = $this->get($this->uri);

        // Assert that the response status code is 200 (OK)
        $response->assertStatus(200);

        // Assert that the response contains the categories
        $response->assertJsonStructure(['data', 'meta', 'links']);
    }

    // this tests the show method in the controller
    public function testGetCourses()
    {
        $course = Course::factory(1)->create();

        $response = $this->get($this->uri.'/'.$course[0]->id);

        $response->assertStatus(200);

        // Decode the JSON response
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
        $course = Course::factory(1)->create();
        $response = $this->patch($this->uri.'/'.$course[0]->id, ['provider_course_name' => 'TestUpdate']);
        $response->assertStatus(200);
        assert($response['data']['provider_course_name'] == 'TestNameUpdate');
    }

    // this tests the destroy method in the controller
    public function testDeleteCourse()
    {
        $course = Course::factory(1)->create();
        $response = $this->delete($this->uri.'/'.$course[0]->id);
        $response->assertStatus(204);
    }
}
