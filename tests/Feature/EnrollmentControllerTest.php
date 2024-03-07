<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\ProviderPlatform;
use App\Models\User;
use Database\Seeders\TestSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EnrollmentControllerTest extends TestCase
{
    use RefreshDatabase;

    public string $uri = '/api/v1/enrollments';

    public $seeder = TestSeeder::class;

    public $single_enrollment_structure = [
        'data' => [
            'user_id',
            'course_id',
            'provider_user_id',
            'provider_enrollment_id',
            'enrollment_state',
            'provider_start_at',
            'provider_end_at',
            'link_url',
        ],
    ];

    // Each controllers test should store these properties for assertion
    public $single_join_json_structure = [
        'data' => [
            'id',
            'course_name',
            'course_description',
            'user_id',
            'course_id',
            'user_name',
            'provider_platform_id',
            'provider_course_id',
            'provider_enrollment_id',
            'provider_user_id',
            'provider_platform_name',
            'provider_platform_url',
            'provider_platform_icon_url',
            'enrollment_state',
            'img_url',
            'link_url',
            'provider_start_at',
            'provider_end_at',
            'created_at',
            'updated_at',
        ],
    ];

    public $array_join_json_structure = [
        'data' => [
            '*' => [
                'id',
                'course_name',
                'course_description',
                'user_id',
                'course_id',
                'user_name',
                'provider_platform_id',
                'provider_course_id',
                'provider_enrollment_id',
                'provider_user_id',
                'provider_platform_name',
                'provider_platform_url',
                'provider_platform_icon_url',
                'enrollment_state',
                'img_url',
                'link_url',
                'provider_start_at',
                'provider_end_at',
                'created_at',
                'updated_at',
            ],
        ],
    ];

    public function testAdminCanCreateAndAccessEnrollments()
    {
        $this->seed($this->seeder);
        $user = User::factory()->createOne();

        $admin = \App\Models\User::factory()->admin()->createOne();

        $users_enrollments = Enrollment::factory()->count(5)->forUser($user->id)->make();

        foreach ($users_enrollments as $enrollment) {
            $fail = $this->actingAs($user)->postJson($this->uri, $enrollment->toArray());
            $fail->assertStatus(403);
            $response = $this->actingAs($admin)->postJson($this->uri, $enrollment->toArray());
            $response->assertStatus(201);
            $response->assertJsonStructure($this->single_enrollment_structure);
        }
        $responseUser = $this->actingAs($user)->getJson($this->uri);

        $responseAdmin = $this->actingAs($admin)->getJson($this->uri);

        $responseAdmin->assertJsonCount(10, 'data');

        $responseUser->assertJsonCount(5, 'data');
    }

    public function testCreateEnrollments()
    {
        $user = \App\Models\User::factory()->createOne();
        $admin = \App\Models\User::factory()->admin()->createOne();
        $course = Course::factory()->createOne();
        $provider = ProviderPlatform::factory()->createOne();
        $enrollments = Enrollment::factory()->count(5)->make();
        foreach ($enrollments as $enrollment) {
            $enrollment->user_id = $user->id;
            $enrollment->course_id = $course->id;
            $enrollment->provider_platform_id = $provider->id;
            $response = $this->actingAs($admin)->post($this->uri, $enrollment->toArray());
            $response->assertStatus(201);
        }
        $resp = $this->actingAs($user)->get($this->uri, [
            'Accept' => 'application/json',
        ]);
        $resp->assertJsonCount(5, 'data');
    }

    public function testEnrollmentsCannotBeCreatedByUnauthorizedUser()
    {
        $user = \App\Models\User::factory()->createOne();
        $enrollment = Enrollment::factory()->makeOne();
        $response = $this->actingAs($user)->post($this->uri, $enrollment->toArray());
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
        $user = \App\Models\User::factory()->createOne();
        Enrollment::factory(2)->create();
        $response = $this->actingAs($user)->get($this->uri);
        $response->assertStatus(200);
        $response->assertJsonStructure($this->array_join_json_structure);
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
    }

    public function testUpdateEnrollment()
    {
        $user = \App\Models\User::factory()->admin()->createOne();
        $enrollment = Enrollment::factory(1)->create();

        $response = $this->actingAs($user)->patch($this->uri.'/'.$enrollment[0]->id, [
            'enrollment_state' => 'completed',
            'link_url' => 'http://example.com',
        ]);

        // Assert the final status
        $response->assertStatus(200);

        // Check if the 'enrollment_state' is updated to 'completed'
        $this->assertEquals('completed', $response['data']['enrollment_state']);
    }

    public function testUpdateEnrollmentUnauthorized()
    {
        $user = \App\Models\User::factory()->createOne();
        $enrollment = Enrollment::factory(1)->create();

        $response = $this->actingAs($user)->patch($this->uri.'/'.$enrollment[0]->id, [
            'enrollment_state' => 'completed',
            'link_url' => 'http://example.com',
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
