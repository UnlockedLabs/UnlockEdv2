<?php

namespace Tests\Feature;

use App\Models\ProviderPlatform;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProviderPlatformControllerTest extends TestCase
{
    use RefreshDatabase;

    public string $uri = '/api/v1/provider-platforms';

    public function testGetProviderPlatform()
    {
        $user = \App\Models\User::factory()->admin()->create();
        $providerPlatform = ProviderPlatform::factory()->create();

        $response = $this->actingAs($user)->get($this->uri.'/'.$providerPlatform->id);

        $response->assertStatus(200);
    }

    public function testGetProviderPlatformUnauthorized()
    {
        $user = \App\Models\User::factory()->create();
        $providerPlatform = ProviderPlatform::factory()->create();

        $response = $this->actingAs($user)->get($this->uri.'/'.$providerPlatform->id);

        $response->assertStatus(403);
    }

    public function testGetProviderPlatformsUnauthorized()
    {
        $user = \App\Models\User::factory()->create();

        $response = $this->actingAs($user)->get($this->uri);
        $response->assertStatus(403);
    }

    public function testGetProviderPlatforms()
    {
        $user = \App\Models\User::factory()->admin()->create();
        $response = $this->actingAs($user)->get($this->uri);
        echo $response->getContent();
        $response->assertStatus(200);
    }

    public function testCreateProviderPlatform()
    {
        $user = \App\Models\User::factory()->admin()->create();
        $response = $this->actingAs($user)->post($this->uri.'/', [
            'type' => 'canvas_cloud',
            'name' => 'Test',
            'description' => 'Test desciption',
            'icon_url' => 'https://test.placeholder.com/640x480.png/0066cc?text=qui',
            'account_id' => '123456789',
            'access_key' => 'testaccesskey123',
            'base_url' => 'http://testurl.org/qui-nesciunt-qui-expedita',
            'state' => 'enabled',
        ]);
        $response->assertStatus(201);
        $response->assertCreated();
    }

    public function testCreateProviderPlatformUnauthorized()
    {
        $user = \App\Models\User::factory()->create();
        $response = $this->actingAs($user)->post($this->uri.'/', [
            'type' => 'canvas_cloud',
            'name' => 'Test',
            'description' => 'Test desciption',
            'icon_url' => 'https://test.placeholder.com/640x480.png/0066cc?text=qui',
            'account_id' => '123456789',
            'access_key' => 'testaccesskey123',
            'base_url' => 'http://testurl.org/qui-nesciunt-qui-expedita',
            'state' => 'enabled',
        ]);
        $response->assertStatus(403);
    }

    public function testUpdateProviderPlatform()
    {
        $user = \App\Models\User::factory()->admin()->create();
        $providerPlatform = \App\Models\ProviderPlatform::factory()->create();
        $response = $this->actingAs($user)->patch($this->uri.'/'.$providerPlatform->id, ['name' => 'TestUpdate']);
        $response->assertStatus(200);
        assert($response['data']['name'] == 'TestUpdate');
    }

    public function testUpdateProviderPlatformUnauthorized()
    {
        $user = \App\Models\User::factory()->create();
        $providerPlatform = \App\Models\ProviderPlatform::factory()->create();
        $response = $this->actingAs($user)->patch($this->uri.'/'.$providerPlatform->id, ['name' => 'TestUpdate']);
        $response->assertStatus(403);
        assert($response['data']['name'] == 'TestUpdate');
    }

    public function testDeleteProviderPlatform()
    {
        $user = \App\Models\User::factory()->admin()->create();
        $providerPlatform = \App\Models\ProviderPlatform::factory()->create();
        $response = $this->actingAs($user)->delete($this->uri.'/'.$providerPlatform->id);
        $response->assertStatus(204);
    }

    public function testDeleteProviderPlatformUnauthorized()
    {
        $user = \App\Models\User::factory()->create();
        $providerPlatform = \App\Models\ProviderPlatform::factory()->create();
        $response = $this->actingAs($user)->delete($this->uri.'/'.$providerPlatform->id);
        $response->assertStatus(403);
    }
}
