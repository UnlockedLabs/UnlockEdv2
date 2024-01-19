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
        $providerPlatform = ProviderPlatform::factory()->create();

        $response = $this->get($this->uri.'/'.$providerPlatform->id);

        $response->assertStatus(200);
    }

    public function testGetProviderPlatforms()
    {
        $response = $this->get($this->uri);
        echo $response->getContent();
        $response->assertStatus(200);
    }

    public function testCreateProviderPlatform()
    {
        $response = $this->post($this->uri.'/', [
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

    public function testUpdateProviderPlatform()
    {
        $providerPlatform = \App\Models\ProviderPlatform::factory()->create();
        $response = $this->patch($this->uri.'/'.$providerPlatform->id, ['name' => 'TestUpdate']);
        $response->assertStatus(200);
        assert($response['data']['name'] == 'TestUpdate');
    }

    public function testDeleteProviderPlatform()
    {
        $providerPlatform = \App\Models\ProviderPlatform::factory()->create();
        $response = $this->delete($this->uri.'/'.$providerPlatform->id);
        $response->assertStatus(204);
    }
}
