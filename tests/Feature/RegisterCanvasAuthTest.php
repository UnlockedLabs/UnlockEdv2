<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegisterCanvasAuthTest extends TestCase
{
    use RefreshDatabase;

    /**
     * A basic feature test example.
     */
    public function test_example(): void
    {
        $data = [
            'provider_platform_id' => '1',
            'auth_provider_url' => 'http://172.16.20.42',
        ];
        $response = $this->postJson('/api/v1/actions/register-canvas-auth', $data);

        $response->assertStatus(200);
    }
}
