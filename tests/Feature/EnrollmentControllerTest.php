<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\ProviderPlatform;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EnrollmentControllerTest extends TestCase
{
    use RefreshDatabase;

    public string $uri = '/api/v1/enrollments';

    public function testEnrollmentsAreCreated()
    {
        $user = \App\Models\User::factory()->admin()->createOne();
        Enrollment::factory(10)->create();

        $response = $this->actingAs($user)->get($this->uri, [
            'Accept' => 'application/json',
        ]);

        $response->assertOk();
        $this->assertCount(10, $response['data']);
    }

    // .... i have no words for some of these tests. We can do better
    public function testActuallyCreatingEnrollmentInsteadOfJustThatTheFactoryWorks()
    {
        $user = \App\Models\User::factory()->admin()->createOne();
        $course = Course::factory()->createOne();
        $provider = ProviderPlatform::factory()->createOne();
        $enrollment = [
            'user_id' => User::factory()->createOne()->id,
            'course_id' => $course->id,
            'provider_id' => $provider->id,
            'enrollment_state' => 'active',
            'links' => '[{"link1":"Test"},{"link2":"Test"}]',
            'provider_start_at' => '2021-01-01 00:00:00',
            'provider_end_at' => '2021-12-31 23:59:59',
        ];
        $response = $this->actingAs($user)->post($this->uri, $enrollment);

        $response->assertOk();
    }

    public function testEnrollmentsCannotBeCreatedByUnauthorizedUser()
    {
        $user = \App\Models\User::factory()->createOne();
        $enrollment = [
            'user_id' => User::factory()->createOne()->id,
            'course_id' => Course::factory()->createOne()->id,
            'provider_id' => ProviderPlatform::factory()->createOne()->id,
            'enrollment_state' => 'active',
            'links' => '[{"link1":"Test"},{"link2":"Test"}]',
            'provider_start_at' => '2021-01-01 00:00:00',
            'provider_end_at' => '2021-12-31 23:59:59',
        ];
        $response = $this->actingAs($user)->post($this->uri, $enrollment);
        $response->assertStatus(403);
    }

    public function testEnrollmentsAreCreatedUnauthorized()
    {
        $user = \App\Models\User::factory()->createOne();
        Enrollment::factory(10)->create();
        $response = $this->actingAs($user)->get($this->uri, [
            'Accept' => 'application/json',
        ]);
        $response->assertStatus(200);
        foreach ($response['data'] as $enrollment) {
            $this->assertEquals($user->id, $enrollment['user_id']);
        }
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
        $Enrollment = Enrollment::factory()->forUser($user->id)->createOne();
        $response = $this->actingAs($user)->get($this->uri.'/'.$Enrollment->id);

        $response->assertStatus(200);

        // Decode the JSON response
        $jsonResponse = $response->json();

        // Assert that the response contains the Enrollment
        foreach ($jsonResponse as $key => $value) {
            // Skip keys 'created_at' and 'updated_at'
            if (in_array($key, ['created_at', 'updated_at'])) {
                continue;
            }

            assert($value, $Enrollment->$key);
        }

        // this is a change
    }

    public function testUpdateEnrollment()
    {
        $user = \App\Models\User::factory()->admin()->createOne();
        $enrollment = Enrollment::factory(1)->create();

        $response = $this->actingAs($user)->patch($this->uri.'/'.$enrollment[0]->id, [
            'enrollment_state' => 'completed',
            'links' => '[{"link1":"Test"},{"link2":"Update"}]',
        ]);

        // Assert the final status
        $response->assertStatus(200);

        // Check if the 'enrollment_state' is updated to 'completed'
        $this->assertEquals('completed', $response['data']['enrollment_state']);
        $this->assertEquals('[{"link1":"Test"},{"link2":"Update"}]', $response['data']['links']);
    }

    public function testUpdateEnrollmentUnauthorized()
    {
        $user = \App\Models\User::factory()->createOne();
        $enrollment = Enrollment::factory(1)->create();

        $response = $this->actingAs($user)->patch($this->uri.'/'.$enrollment[0]->id, [
            'enrollment_state' => 'completed',
            'links' => '[{"link1":"Test"},{"link2":"Update"}]',
        ]);

        $response->assertStatus(403);
    }

    public function testDeleteEnrollment()
    {
        $user = \App\Models\User::factory()->admin()->createOne();
        $Enrollment = Enrollment::factory(1)->create();
        $response = $this->actingAs($user)->delete($this->uri.'/'.$Enrollment[0]->id);
        $response->assertStatus(204);
    }

    public function testDeleteEnrollmentUnauthorized()
    {
        $user = \App\Models\User::factory()->createOne();
        $Enrollment = Enrollment::factory(1)->create();
        $response = $this->actingAs($user)->delete($this->uri.'/'.$Enrollment[0]->id);
        $response->assertStatus(403);
    }
}
