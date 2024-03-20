<?php

use App\Models\User;
use Database\Seeders\TestSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserActivityMapControllerTest extends TestCase
{
    use RefreshDatabase;

    public function testGetUserActivityMap()
    {
        $this->seed(TestSeeder::class);
        $randomUserId = mt_rand(1, 6);
        $user = User::find($randomUserId);

        $response = $this->actingAs($user)->get('/api/v1/user-activity-map/'.$user->id);
        $response->assertStatus(200)
            ->assertJsonStructure([
                '*' => [
                    'user_id',
                    'date',
                    'active_course_count',
                    'total_activity_time',
                    'total_activity_time_quartile',
                ],
            ]);

        // Ensure quartile scores are within expected range
        $responseData = $response->json();
        foreach ($responseData as $data) {
            $this->assertGreaterThanOrEqual(0, $data['total_activity_time_quartile']);
            $this->assertLessThanOrEqual(4, $data['total_activity_time_quartile']);
        }
    }
}
