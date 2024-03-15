<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Jobs\UserCourseActivityTask;
use App\Models\User;
use App\Models\UserCourseActivity;
use Database\Seeders\DefaultAdmin;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserCourseActivityTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function it_processes_user_activity_data_correctly()
    {
        $this->refreshDatabase();
        $this->seed(DefaultAdmin::class);
        $admin = User::factory()->admin()->createOne();
        // import canvas users into the system
        $resp =  $this->actingAs($admin)->post('api/v1/actions/import-canvas-users', ['provider_platform_id' => 1]);
        $resp->assertSuccessful();
        $resp = $this->actingAs($admin)->post('api/v1/actions/store-canvas-courses', ['provider_platform_id' => 1]);
        $resp->assertSuccessful();

        $users = User::where('role', UserRole::Student)->get();
        foreach ($users as $user) {
            $id = $user->id;
            $resp = $this->actingAs($admin)->post('api/v1/actions/store-user-enrollments', ['provider_platform_id' => 1, 'user_id' => $id]);
            // run the user course activity task
        }
        $this->assertDatabaseCount('users', 7);
        $job = new UserCourseActivityTask();
        $job->handle();
        $activity = UserCourseActivity::all();
        $this->assertGreaterThanOrEqual(14, $activity->count());
    }
}
