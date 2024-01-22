<?php

namespace Tests\Feature;

use App\Models\Enrollment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EnrollmentControllerTest extends TestCase
{
    use RefreshDatabase;

    public string $uri = '/api/v1/enrollments';

    public function testEnrollmentsAreCreated()
    {
        // Create 10 Enrollments using the factory
        $Enrollments = Enrollment::factory(10)->create();

        // Assert that 10 Enrollments were created
        $this->assertCount(10, $Enrollments);
    }

    public function testEnrollmentsIndexReturnsJson()
    {
        // Create 10 Enrollments using the factory
        Enrollment::factory(2)->create();

        // Make a GET request to the index method
        $response = $this->get($this->uri);

        // Assert that the response status code is 200 (OK)
        $response->assertStatus(200);

        // Assert that the response contains the Enrollments
        $response->assertJsonStructure(['data', 'meta', 'links']);
    }

    public function testGetEnrollment()
    {
        $Enrollment = Enrollment::factory(1)->create();

        $response = $this->get($this->uri.'/'.$Enrollment[0]->id);

        $response->assertStatus(200);

        // Decode the JSON response
        $jsonResponse = $response->json();

        // Assert that the response contains the Enrollment
        foreach ($jsonResponse as $key => $value) {
            // Skip keys 'created_at' and 'updated_at'
            if (in_array($key, ['created_at', 'updated_at'])) {
                continue;
            }

            assert($value, $Enrollment[0]->$key);
        }

        // this is a change
    }

    public function testUpdateEnrollment()
    {
        $enrollment = Enrollment::factory(1)->create();

        $response = $this->patch($this->uri.'/'.$enrollment[0]->id, [
            'enrollment_state' => 'completed',
            'links' => '[{"link1":"Test"},{"link2":"Update"}]'
        ]);

        dump($response);

        // Assert the final status
        $response->assertStatus(200);

        // Check if the 'enrollment_state' is updated to 'completed'
        $this->assertEquals('completed', $response['data']['enrollment_state']);
        $this->assertEquals('[{"link1":"Test"},{"link2":"Update"}]', $response['data']['links']);
    }

    public function testDeleteEnrollment()
    {
        $Enrollment = Enrollment::factory(1)->create();
        $response = $this->delete($this->uri.'/'.$Enrollment[0]->id);
        $response->assertStatus(204);
    }
}
