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
        $user = \App\Models\User::factory()->createOne();
        Enrollment::factory(10)->create();

        $response = $this->actingAs($user)->get($this->uri, [
            'Accept' => 'application/json',
        ]);

        // Assertions
        $response->assertOk();
        // Create 10 Enrollments using the factory

        // Assert that 10 Enrollments were created
        $this->assertCount(10, $response['data']);
    }

    public function testEnrollmentsIndexReturnsJson()
    {
        // Create 10 Enrollments using the factory
        $user = \App\Models\User::factory()->createOne();
        Enrollment::factory(2)->create();

        // Make a GET request to the index method
        $response = $this->actingAs($user)->get($this->uri);

        // Assert that the response status code is 200 (OK)
        $response->assertStatus(200);

        // Assert that the response contains the Enrollments
        $response->assertJsonStructure([
            'data' => [
                '*' => [
                    'user_id',
                    'course_id',
                    'provider_id',
                    'enrollment_state',
                    'links',
                    'provider_start_at',
                    'provider_end_at',
                    'created_at',
                    'updated_at',
                ],
            ],
        ]);
    }

    public function testGetEnrollment()
    {
        $user = \App\Models\User::factory()->createOne();
        $Enrollment = Enrollment::factory(1)->create();

        $response = $this->actingAs($user)->get($this->uri.'/'.$Enrollment[0]->id);

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
        $user = \App\Models\User::factory()->createOne();
        $enrollment = Enrollment::factory(1)->create();

        $response = $this->actingAs($user)->patch($this->uri.'/'.$enrollment[0]->id, [
            'enrollment_state' => 'completed',
            'links' => '[{"link1":"Test"},{"link2":"Update"}]',
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
        $user = \App\Models\User::factory()->createOne();
        $Enrollment = Enrollment::factory(1)->create();
        $response = $this->actingAs($user)->delete($this->uri.'/'.$Enrollment[0]->id);
        $response->assertStatus(204);
    }
}
