<?php

use App\Models\User;
use Database\Seeders\TestSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class UserActivityMapControllerTest extends TestCase
{
    use RefreshDatabase;

    public function testGetUserActivityMap()
    {
        $this->seed(TestSeeder::class);
        // Retrieve a random user_id from the user_course_activities table
        // TestSeeder generates user_course_activities for only some of the users, not all
        $randomUserId = DB::table('user_course_activities')->inRandomOrder()->value('user_id');

        // Find the user using the randomly selected user_id
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

    public function testGetUserActivityMapStartDateOnly()
    {
        $this->seed(TestSeeder::class);
        // Retrieve a random user_id from the user_course_activities table
        // TestSeeder generates user_course_activities for only some of the users, not all
        $randomUserId = DB::table('user_course_activities')->inRandomOrder()->value('user_id');
        // Select date for testing where 25% of the values are before it
        $startDate = DB::table('user_course_activities')
            ->select('date')
            ->orderBy('date', 'asc')
            ->skip(DB::table('user_course_activities')->count() / 4)
            ->take(1)
            ->value('date');

        // Find the user using the randomly selected user_id
        $user = User::find($randomUserId);

        $params = '?start_date='.$startDate;
        $response = $this->actingAs($user)->get('/api/v1/user-activity-map/'.$user->id.$params);
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
        // and dates are all on or after startDate
        $responseData = $response->json();
        foreach ($responseData as $data) {
            $dateFormatted = date('Y-m-d', strtotime($data['date']));
            $this->assertGreaterThanOrEqual(date('Y-m-d', strtotime($startDate)), $dateFormatted);
            $this->assertGreaterThanOrEqual(0, $data['total_activity_time_quartile']);
            $this->assertLessThanOrEqual(4, $data['total_activity_time_quartile']);
        }
    }

    public function testGetUserActivityMapEndDateOnly()
    {
        $this->seed(TestSeeder::class);
        // Retrieve a random user_id from the user_course_activities table
        // TestSeeder generates user_course_activities for only some of the users, not all
        $randomUserId = DB::table('user_course_activities')->inRandomOrder()->value('user_id');
        // Select date for testing where 25% of the values are after it
        $endDate = DB::table('user_course_activities')
            ->select('date')
            ->orderBy('date', 'asc')
            ->skip(3 * DB::table('user_course_activities')->count() / 4)
            ->take(1)
            ->value('date');

        // Find the user using the randomly selected user_id
        $user = User::find($randomUserId);

        $params = '?end_date='.$endDate;
        $response = $this->actingAs($user)->get('/api/v1/user-activity-map/'.$user->id.$params);
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
        // and dates are all on or before endDate
        $responseData = $response->json();
        foreach ($responseData as $data) {
            $dateFormatted = date('Y-m-d', strtotime($data['date']));
            $this->assertLessThanOrEqual(date('Y-m-d', strtotime($endDate)), $dateFormatted);
            $this->assertGreaterThanOrEqual(0, $data['total_activity_time_quartile']);
            $this->assertLessThanOrEqual(4, $data['total_activity_time_quartile']);
        }
    }

    public function testGetUserActivityMapDateRange()
    {
        $this->seed(TestSeeder::class);
        // Retrieve a random user_id from the user_course_activities table
        // TestSeeder generates user_course_activities for only some of the users, not all
        $randomUserId = DB::table('user_course_activities')->inRandomOrder()->value('user_id');
        // Select date for testing where 25% of the values are before it
        $startDate = DB::table('user_course_activities')
            ->select('date')
            ->orderBy('date', 'asc')
            ->skip(DB::table('user_course_activities')->count() / 4)
            ->take(1)
            ->value('date');
        // Select date for testing where 25% of the values are after it
        $endDate = DB::table('user_course_activities')
            ->select('date')
            ->orderBy('date', 'asc')
            ->skip(3 * DB::table('user_course_activities')->count() / 4)
            ->take(1)
            ->value('date');

        // Find the user using the randomly selected user_id
        $user = User::find($randomUserId);

        $params = '?start_date='.$startDate.'&end_date='.$endDate;
        $response = $this->actingAs($user)->get('/api/v1/user-activity-map/'.$user->id.$params);
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
        // and dates are between startDate and endDate
        $responseData = $response->json();
        foreach ($responseData as $data) {
            $dateFormatted = date('Y-m-d', strtotime($data['date']));
            $this->assertGreaterThanOrEqual(date('Y-m-d', strtotime($startDate)), $dateFormatted);
            $this->assertLessThanOrEqual(date('Y-m-d', strtotime($endDate)), $dateFormatted);
            $this->assertGreaterThanOrEqual(0, $data['total_activity_time_quartile']);
            $this->assertLessThanOrEqual(4, $data['total_activity_time_quartile']);
        }
    }
}
