<?php

namespace Tests\Feature;

use App\Models\Enrollment;
use Database\Seeders\TestSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EnrollmentControllerTestGen extends TestCase
{
    use RefreshDatabase;
    public string $url = 'api/v1/enrollments';
    public $seeder = \Database\Seeders\TestSeeder::class;
    public  $single_json_structure = [
        'data' => [
            'id',
            'user_id',
            'course_id',
            'provider_user_id',
            'provider_course_id',
            'provider_platform_id',
            'provider_enrollment_id',
            'enrollment_state',
            'links',
            'provider_start_at',
            'provider_end_at',
            'created_at',
            'updated_at'
        ]
    ];
    public  $array_json_structure = [
        'data' => [
            '*' => [
                'id',
                'user_id',
                'course_id',
                'provider_user_id',
                'provider_course_id',
                'provider_platform_id',
                'provider_enrollment_id',
                'enrollment_state',
                'links',
                'provider_start_at',
                'provider_end_at',
                'created_at',
                'updated_at'
            ],
        ],
    ];


    /* You may need to edit these tests to match the actual behavior of the controller
    * this is just a template and a good starting point, be sure to test for any edge cases
    * and any other behavior that is not covered here
    */
    public function testAdminCanAccessEnrollment()
    {
        $this->seed($this->seeder);
        $admin = \App\Models\User::factory()->admin()->createOne();
        $response = $this->actingAs($admin)->get($this->url);
        $response->assertStatus(200);
        $response->assertJsonStructure($this->array_json_structure);
    }

    public function testUserCanAccessEnrollment()
    {
        // seed to assert there is more than 3 records in the database
        $this->seed($this->seeder);
        // create a regular user
        $user = \App\Models\User::factory()->createOne();
        // create 3 records for the user
        Enrollment::factory(3)->forUser($user->id)->create();
        // assert that the user can access the resource
        $response = $this->actingAs($user)->get($this->url);
        $response->assertStatus(200);
        // assert that the response contains only the 3 records for the user
        $response->assertJsonCount(3, 'data');
        foreach ($response->json('data') as $record) {
            // assert that only the users data is returned
            $this->assertEquals($user->id, $record['user_id']);
        }
    }

    public function testAdminCanCreateEnrollment()
    {
        $this->seed($this->seeder);
        $admin = \App\Models\User::factory()->admin()->createOne();
        $model = Enrollment::factory()->makeOne();
        $response = $this->actingAs($admin)->postJson($this->url, $model->toArray());
        $response->assertStatus(201);
        $response->assertJsonStructure($this->single_json_structure);
    }

    public function testProtectedCreateEnrollment()
    {
        $this->seed($this->seeder);
        $user = \App\Models\User::factory()->createOne();
        $model = Enrollment::factory()->makeOne();
        $response = $this->actingAs($user)->postJson($this->url, $model->toArray());
        $response->assertStatus(403);
    }

    public function testAdminCanUpdateEnrollment()
    {
        $this->seed($this->seeder);
        $admin = \App\Models\User::factory()->admin()->createOne();
        $model = Enrollment::factory()->createOne();
        $response = $this->actingAs($admin)->patchJson($this->url . '/' . $model->id, $model->toArray());
        $response->assertStatus(200);
        $response->assertJsonStructure($this->single_json_structure);
    }

    public function testProtectedUpdateEnrollment()
    {
        $this->seed($this->seeder);
        $user = \App\Models\User::factory()->createOne();
        $model = Enrollment::factory()->createOne();
        $response = $this->actingAs($user)->patch($this->url . '/' . $model->id, $model->toArray());
        $response->assertStatus(403);
    }

    public function testAdminCanDeleteEnrollment()
    {
        $this->seed($this->seeder);
        $admin = \App\Models\User::factory()->admin()->createOne();
        $model = Enrollment::factory()->createOne();
        $response = $this->actingAs($admin)->delete($this->url . '/' . $model->id);
        $response->assertStatus(204);
    }

    public function testProtectedDeleteEnrollment()
    {
        $this->seed($this->seeder);
        $user = \App\Models\User::factory()->createOne();
        $model = Enrollment::factory()->createOne();
        $response = $this->actingAs($user)->delete($this->url . '/' . $model->id);
        $response->assertStatus(403);
    }
}
