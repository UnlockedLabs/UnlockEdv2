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

        $response = $this->get($this->uri . '/' . $user->id);

        $response->assertStatus(200);
    }

    public function testGetUsers()
    {
        $response = $this->get($this->uri);
        echo $response->getContent();
        $response->assertStatus(200);
    }

    public function testCreateUser()
    {
        $response = $this->post($this->uri . '/', [
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
        $response = $this->patch($this->uri . '/' . $user->id, ['name_first' => 'TestUpdate']);
        $response->assertStatus(200);
        assert($response['data']['name_first'] == 'TestUpdate');
    }

    public function testDeleteUser()
    {
        $user = \App\Models\User::factory()->create();
        $response = $this->delete($this->uri . '/' . $user->id);
        $response->assertStatus(204);
    }
}
