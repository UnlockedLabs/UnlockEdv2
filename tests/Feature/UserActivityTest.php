<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserActivity;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserActivityTest extends TestCase
{
    use RefreshDatabase;

    public function testUserActivityFactoryCreatesValidModel(): void
    {
        $userActivity = UserActivity::factory()->create();

        $this->assertInstanceOf(UserActivity::class, $userActivity);
        $this->assertDatabaseCount('user_activities', 1);
    }

    public function testUserActivityFactoryCanCreateForSpecificUser(): void
    {
        $user = User::factory()->create();

        $userActivity = UserActivity::factory()->forUser($user->id)->create();

        $this->assertInstanceOf(UserActivity::class, $userActivity);
        $this->assertEquals($user->id, $userActivity->user_id);
        $this->assertDatabaseCount('user_activities', 1);
    }
}
