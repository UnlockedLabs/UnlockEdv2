<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserControllerTest extends TestCase
{
    use RefreshDatabase;

    public string $uri = '/api/v1/users/';

    public function testGetUser()
    {
        $user = \App\Models\User::factory()->create();

        $response = $this->get($this->uri . $user->id);

        $response->assertStatus(200);
    }

    public function testGetUsers()
    {
        $response = $this->get($this->uri);
        $response->assertStatus(200);
    }

    public function testCreateUser()
    {
        $response = $this->post($this->uri, [
            'name_first' => 'Test',
            'name_last' => 'User',
            'username' => 'testuser',
            'role' => 'Student',
        ]);
        $response->assertStatus(201);
        $response->assertCreated();
    }

    public function testDeleteUser()
    {
        $user = \App\Models\User::factory()->create();
        $response = $this->delete($this->uri  . $user->id);
        $response->assertStatus(204);
    }
}
