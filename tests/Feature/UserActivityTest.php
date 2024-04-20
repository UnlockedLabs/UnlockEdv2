<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserActivity;
use Database\Seeders\TestSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserActivityTest extends TestCase
{
    use RefreshDatabase;

    public string $uri = '/api/v1/user-activities';

    public $seeder = TestSeeder::class;

    // Each controllers test should store these properties for assertion
    public $single_json_structure = [
        'data' => [
            'user_id',
            'browser_name',
            'platform',
            'device',
            'clicked_url',
            'created_at',
            'updated_at',
        ],
    ];

    public $array_json_structure = [
        'data' => [
            '*' => [
                'user_id',
                'browser_name',
                'platform',
                'device',
                'clicked_url',
                'created_at',
                'updated_at',
            ],
        ],
    ];

    public function testAdminCanCreateUserActivitiesForAnyone()
    {
        $user = User::factory()->createOne();
        $admin = User::factory()->admin()->createOne();

        $userActivities = UserActivity::factory()->count(5)->forUser($user->id)->make();

        foreach ($userActivities as $activity) {
            $response = $this->actingAs($admin)->postJson($this->uri, $activity->toArray());
            $response->assertStatus(201);
            $response->assertJsonStructure($this->single_json_structure);

            $this->assertEquals($user->id, $response['data']['user_id']);
        }
    }

    public function testUserCanCreateUserActivitiesForThemselves()
    {
        $user = User::factory()->createOne();

        $userActivities = UserActivity::factory()->count(5)->forUser($user->id)->make();

        foreach ($userActivities as $activity) {
            $response = $this->actingAs($user)->postJson($this->uri, $activity->toArray());
            $response->assertStatus(201);
            $response->assertJsonStructure($this->single_json_structure);

            $this->assertEquals($user->id, $response['data']['user_id']);
        }
    }

    public function testUserCannotCreateUserActivitiesForAnotherUser()
    {
        $user = User::factory()->createOne();
        $anotherUser = User::factory()->createOne();

        $userActivities = UserActivity::factory()->count(5)->forUser($anotherUser->id)->make();
        foreach ($userActivities as $activity) {
            $response = $this->actingAs($user)->postJson($this->uri, $activity->toArray());
            $response->assertStatus(403);
        }
    }

    public function testAdminCanShowUserActivity()
    {
        $this->seed(TestSeeder::class);
        $admin = User::factory()->admin()->create();
        $user = User::inRandomOrder()->first();
        $response = $this->actingAs($admin)->getJson($this->uri.'/'.$user->id);

        $response->assertStatus(200);
        $response->assertJsonStructure($this->array_json_structure);
    }

    public function testUserCanShowOwnUserActivity()
    {
        $user = User::factory()->create();
        $userActivity = UserActivity::factory()->forUser($user->id)->makeOne();
        $userActivity->save();
        $response = $this->actingAs($user)->getJson($this->uri.'/'.$user->id);

        $response->assertStatus(200);
        $response->assertJsonStructure($this->array_json_structure);
    }

    public function testUserCannotShowOtherUserActivity()
    {
        $this->seed(TestSeeder::class);
        $user = User::inRandomOrder()->first();
        $otherUser = User::factory()->create();
        $otherUserActivity = UserActivity::factory()->forUser($otherUser->id)->create();
        $response = $this->actingAs($user)->getJson($this->uri.'/'.$otherUser->id);
        $response->assertStatus(403);
    }

    public function testUserCanAccessOwnUserActivities()
    {
        $this->seed(TestSeeder::class);
        $user = User::factory()->createOne();
        UserActivity::factory()->count(5)->forUser($user->id)->create();
        $response = $this->actingAs($user)->getJson($this->uri);
        $response->assertStatus(200);
        $response->assertJsonStructure($this->array_json_structure);

        // every response record must belong to $user
        foreach ($response['data'] as $record) {
            $this->assertEquals($user->id, $record['user_id']);
        }
    }

    public function testAdminCanAccessAllUserActivities()
    {
        $admin = User::factory()->admin()->createOne();
        $user = User::factory()->createOne();
        UserActivity::factory()->count(10)->forUser($user->id)->create();

        $response = $this->actingAs($admin)->getJson($this->uri);

        $response->assertStatus(200);
        $response->assertJsonCount(10, 'data');
        $response->assertJsonStructure($this->array_json_structure);
    }

    public function testAdminCanSearchUserActivitiesByUrl()
    {
        $admin = User::factory()->admin()->createOne();
        $user = User::factory()->createOne();
        $activity = UserActivity::factory()->count(1)->forUser($user->id)->create();
        UserActivity::factory()->count(5)->create();

        $url = $activity[0]->clicked_url;
        $parsed_url = parse_url($url);
        $response = $this->actingAs($admin)->getJson($this->uri.'?search='.$parsed_url['host']);

        $response->assertStatus(200);
        $response->assertJsonStructure($this->array_json_structure);
        $response->assertJsonFragment([
            'clicked_url' => $url,
        ]);
    }

    public function testAdminCanSearchUserActivitiesByName(): void
    {
        $admin = User::factory()->admin()->createOne();
        $user = User::factory()->createOne();
        UserActivity::factory()->count(1)->forUser($user->id)->create();
        UserActivity::factory()->count(5)->create();

        $name_first = $user['name_first'];
        $response = $this->actingAs($admin)->getJson($this->uri.'?search='.$name_first);

        $response->assertStatus(200);
        $response->assertJsonStructure($this->array_json_structure);
        $response->assertJsonFragment([
            'user_name_first' => $name_first,
        ]);
    }
}
