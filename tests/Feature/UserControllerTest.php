<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use Database\Seeders\TestSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserControllerTest extends TestCase
{
    use RefreshDatabase;

    public string $uri = '/api/v1/users';

    public function testGetUser()
    {
        $this->seed(TestSeeder::class);
        $user = \App\Models\User::inRandomOrder()->first();
        $response = $this->actingAs($user)->get($this->uri.'/'.$user->id);
        $response->assertStatus(200);
    }

    public function testGetUserUnauthorized()
    {
        $this->seed(TestSeeder::class);
        $user = \App\Models\User::inRandomOrder()->first();
        $response = $this->actingAs($user)->get($this->uri);
        $response->assertStatus(403);
    }

    public function testGetUsersAuthorized()
    {
        $this->seed(TestSeeder::class);
        $user = \App\Models\User::factory()->admin()->create();
        $response = $this->actingAs($user)->get($this->uri);
        $response->assertStatus(200);
    }

    public function testCreateUser()
    {
        $user = \App\Models\User::factory()->admin()->create();
        $created = \App\Models\User::factory()->makeOne();
        $response = $this->actingAs($user)->post($this->uri, $created->toArray());
        $response->assertStatus(201);
        $response->assertCreated();
    }

    public function testCreateUserUnauthorized()
    {
        $this->seed(TestSeeder::class);
        $user = \App\Models\User::factory()->create();
        $created = \App\Models\User::factory()->makeOne();
        $response = $this->actingAs($user)->post($this->uri, $created->toArray());
        $response->assertStatus(403);
    }

    public function testUpdateUser()
    {
        $this->seed(TestSeeder::class);
        $user = \App\Models\User::factory()->admin()->create();
        $response = $this->actingAs($user)->patch($this->uri.'/'.$user->id, ['name_first' => 'TestUpdate', 'role' => UserRole::ADMIN]);
        $response->assertStatus(200);
        $this->assertTrue($response['data']['name_first'] == 'TestUpdate');
        $response->assertJsonStructure([
            'data' => [
                'id',
                'name_first',
                'name_last',
                'username',
                'created_at',
                'updated_at',
            ],
        ]);
    }

    public function testUpdateUserUnauthorized()
    {
        $this->seed(TestSeeder::class);
        $user = \App\Models\User::factory()->create();
        $response = $this->actingAs($user)->patch($this->uri.'/'.$user->id, ['name_first' => 'TestUpdate']);
        $response->assertStatus(403);
    }

    public function testDeleteUser()
    {
        $this->seed(TestSeeder::class);
        $user = \App\Models\User::factory()->admin()->create();
        $delete = \App\Models\User::inRandomOrder()->first();
        $response = $this->actingAs($user)->delete($this->uri.'/'.$delete->id);
        $response->assertStatus(204);
    }

    public function testDeleteUserUnauthorized()
    {
        $user = \App\Models\User::factory()->create();
        $response = $this->actingAs($user)->delete($this->uri.'/'.$user->id);
        $response->assertStatus(403);
    }
}
