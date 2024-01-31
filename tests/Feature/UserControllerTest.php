<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserControllerTest extends TestCase
{
    use RefreshDatabase;

    public string $uri = '/api/v1/users';

    public function testGetUser()
    {
        $user = \App\Models\User::factory()->create();

        $response = $this->actingAs($user)->get($this->uri.'/'.$user->id);

        $response->assertStatus(200);
    }

    public function testGetUsers()
    {
        $user = \App\Models\User::factory()->create();
        $response = $this->actingAs($user)->get($this->uri);
        echo $response->getContent();
        $response->assertStatus(200);
    }

    public function testCreateUser()
    {
        $user = \App\Models\User::factory()->create();
        $response = $this->actingAs($user)->post($this->uri.'/', [
            'name_first' => 'Test',
            'name_last' => 'User',
            'username' => 'testuser',
            'role' => 'Student',
        ]);
        $response->assertStatus(201);
        $response->assertCreated();
    }

    public function testUpdateUser()
    {
        $user = \App\Models\User::factory()->create();
        $response = $this->actingAs($user)->patch($this->uri.'/'.$user->id, ['name_first' => 'TestUpdate']);
        $response->assertStatus(200);
        assert($response['data']['name_first'] == 'TestUpdate');
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

    public function testDeleteUser()
    {
        $user = \App\Models\User::factory()->create();
        $response = $this->actingAs($user)->delete($this->uri.'/'.$user->id);
        $response->assertStatus(204);
    }
}
