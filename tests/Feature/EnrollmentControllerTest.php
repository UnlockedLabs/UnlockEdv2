<?php

namespace Tests\Feature;

use App\Models\Enrollment;
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
            'external_enrollment_id',
            'enrollment_state',
            'external_start_at',
            'external_end_at',
            'external_link_url',
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
            'external_course_id',
            'external_enrollment_id',
            'external_user_id',
            'provider_platform_name',
            'provider_platform_url',
            'provider_platform_icon_url',
            'enrollment_state',
            'img_url',
            'external_link_url',
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
                'external_course_id',
                'external_enrollment_id',
                'external_user_id',
                'provider_platform_name',
                'provider_platform_url',
                'provider_platform_icon_url',
                'enrollment_state',
                'img_url',
                'external_link_url',
                'external_start_at',
                'external_end_at',
                'created_at',
                'updated_at',
            ],
        ],
    ];

    public function properlySeedEnrollment(bool $persist): Enrollment
    {
        $provider = \App\Models\ProviderPlatform::factory()->createOne();
        $course = \App\Models\Course::factory()->forProviderPlatform($provider->id)->makeOne();
        $course->save();
        $enrollment = Enrollment::factory()->forCourse($course->id)->makeOne();
        $persist ? $enrollment->save() : null;

        return $enrollment;
    }

    public function completeTestCreateAndGetNewEnrollment()
    {
        $this->seed($this->seeder);
        $user = User::inRandomOrder()->first();
        $admin = \App\Models\User::factory()->admin()->createOne();
        $enrollment = $this->properlySeedEnrollment(false);
        // user cannot create themselves
        $fail = $this->actingAs($user)->postJson($this->uri, $enrollment->toArray());
        $fail->assertStatus(403);
        // assert admin can create them
        $response = $this->actingAs($admin)->postJson($this->uri, $enrollment->toArray());
        $response->assertStatus(201);
        $response->assertJsonStructure($this->single_enrollment_structure);
        $id = $response['data']['id'];

        // test user can acess their own enrollment
        $responseUser = $this->actingAs($user)->getJson($this->uri.'/'.$id);
        $responseUser->assertStatus(200);
        $responseUser->assertJsonStructure($this->single_join_json_structure);
        // test admin can access all enrollments
        $responseAdmin = $this->actingAs($admin)->getJson($this->uri);
        $responseAdmin->assertJsonCount(10, 'data');
        $responseAdmin->assertJsonStructure($this->array_join_json_structure);
    }

    public function testUpdateEnrollment()
    {
        $user = \App\Models\User::factory()->admin()->createOne();
        $enrollment = $this->properlySeedEnrollment(true);

        $response = $this->actingAs($user)->patch($this->uri.'/'.$enrollment->id, [
            'enrollment_state' => 'completed',
            'external_link_url' => 'http://example.com',
        ]);

        // Assert the final status
        $response->assertStatus(200);

        // Check if the 'enrollment_state' is updated to 'completed'
        $this->assertEquals('completed', $response['data']['enrollment_state']);
    }

    public function testUpdateEnrollmentUnauthorized()
    {
        $user = \App\Models\User::factory()->createOne();
        $enrollment = $this->properlySeedEnrollment(true);

        $response = $this->actingAs($user)->patch($this->uri.'/'.$enrollment->id, [
            'enrollment_state' => 'completed',
            'external_link_url' => 'http://example.com',
        ]);

        $response->assertStatus(403);
    }

    public function testDeleteEnrollment()
    {
        $user = \App\Models\User::factory()->admin()->createOne();
        $enrollment = $this->properlySeedEnrollment(true);
        $response = $this->actingAs($user)->delete($this->uri.'/'.$enrollment->id);
        $response->assertStatus(204);
    }

    public function testDeleteEnrollmentUnauthorized()
    {
        $user = \App\Models\User::factory()->createOne();
        $enrollment = $this->properlySeedEnrollment(true);
        $response = $this->actingAs($user)->delete($this->uri.'/'.$enrollment->id);
        $response->assertStatus(403);
    }
}
