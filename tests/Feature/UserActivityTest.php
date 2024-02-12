<?php

namespace Tests\Feature;

use App\Models\UserActivity;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserActivityTest extends TestCase
{
    use RefreshDatabase;

    public function testUserActivitiesAreCreated(): void
    {
        // Create 10 user activities using the factory
        UserActivity::factory(10)->create();

        // Assert that there are 10 user activities in the database
        $this->assertEquals(10, UserActivity::count());
    }
}
