<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DefaultAdmin;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CanvasIntegrationTests extends TestCase
{
    use RefreshDatabase;

    public $PROV_ID = 1;

    public $USER_ID = 2;

    /**
     * A basic feature test example.
     */
    public function test_fetching_courses_and_enrollments(): void
    {
        if (env('CI')) {
            $this->markTestSkipped('Skipping test in CI environment');
        }
        $this->refreshDatabase();
        $this->seed(DatabaseSeeder::class);
        $admin = User::factory()->admin()->createOne();
        $proc = [
            'provider_platform_id' => $this->PROV_ID,
        ];
        $courses = $this->actingAs($admin)->post('api/v1/actions/store-canvas-courses', $proc);
        $courses->assertSuccessful();
        $data = $courses->json()['data'];
        // there are 6 courses on canvas instance
        $this->assertCount(6, $data);
        $enroll = [
            'user_id' => $this->USER_ID,
            'provider_platform_id' => $this->PROV_ID,
        ];
        $enrollments = $this->actingAs($admin)->post('api/v1/actions/store-user-enrollments', $enroll);
        $enrollments = $enrollments->json()['data'];
        // Chris is enrolled in 5 of the courses
        $this->assertCount(5, $enrollments);
        // Ensure that the database has the expected number of courses and enrollments
        $this->assertDatabaseCount('courses', 6);
        $this->assertDatabaseCount('enrollments', 5);
    }

    public function test_fetching_users_from_canvas(): void
    {
        if (env('CI')) {
            $this->markTestSkipped('Skipping test in CI environment');
        }
        // make sure db has the default admin so user id's line up
        $this->refreshDatabase();
        $this->seed(DefaultAdmin::class);
        $admin = User::factory()->admin()->createOne();
        $req = [
            'provider_platform_id' => $this->PROV_ID,
        ];
        $resp = $this->actingAs($admin)->post('api/v1/actions/import-canvas-users', $req);
        $resp->assertSuccessful();
        $users = User::where(['role' => UserRole::Student])->get();
        $this->assertDatabaseCount('users', 7);
        foreach ($users as $user) {
            // assert each has a provider mapping, and that they exist
            $this->assertNotNull($user->externalIdFor($this->PROV_ID));
        }
    }
}
