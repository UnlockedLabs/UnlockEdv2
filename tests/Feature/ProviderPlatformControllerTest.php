<?php

namespace Tests\Feature;

use App\Models\ProviderPlatform;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Tests\TestCase;

class ProviderPlatformControllerTest extends TestCase
{
    use RefreshDatabase;

    public string $uri = '/api/v1/provider-platforms';

    public function testGetProviderPlatform()
    {
        $this->refreshDatabase();
        $user = \App\Models\User::factory()->admin()->create();
        $providerPlatform = ProviderPlatform::factory()->makeOne();
        $resp = $this->actingAs($user)->post($this->uri, $providerPlatform->toArray());
        $resp->assertSuccessful();
        $providerPlatform = ProviderPlatform::first();
        $response = $this->actingAs($user)->get($this->uri.'/'.$providerPlatform->id);
        $response->assertStatus(200);
        $response->assertJsonFragment(['name' => $providerPlatform->name, 'type' => $providerPlatform->type->value, 'description' => $providerPlatform->description, 'icon_url' => $providerPlatform->icon_url, 'account_id' => $providerPlatform->account_id, 'base_url' => $providerPlatform->base_url, 'state' => $providerPlatform->state->value]);
    }

    public function testGetProviderPlatformWithKey()
    {
        $this->refreshDatabase();
        $user = \App\Models\User::factory()->admin()->create();
        $providerPlatform = ProviderPlatform::factory()->makeOne();
        $resp = $this->actingAs($user)->post($this->uri, $providerPlatform->toArray());
        $resp->assertSuccessful();
        $providerPlatform = ProviderPlatform::first();
        $response = $this->actingAs($user)->get($this->uri.'/'.$providerPlatform->id.'?show_key=true');
        $response->assertStatus(200);
        $response->assertJsonFragment(['name' => $providerPlatform->name, 'type' => $providerPlatform->type->value, 'description' => $providerPlatform->description, 'icon_url' => $providerPlatform->icon_url, 'account_id' => $providerPlatform->account_id, 'base_url' => $providerPlatform->base_url, 'state' => $providerPlatform->state->value, 'access_key' => Crypt::decryptString($providerPlatform->access_key)]);
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
            'base_url' => 'http://testurl.org/qui-nesciunt-qui-expedita',
            'state' => 'enabled',
        ]);
        $response->assertStatus(403);
    }

    public function testUpdateProviderPlatform()
    {
        $user = \App\Models\User::factory()->admin()->create();
        $providerPlatform = \App\Models\ProviderPlatform::factory()->create();
        $response = $this->actingAs($user)->patch($this->uri.'/'.$providerPlatform->id, ['name' => 'TestUpdate', 'type' => 'canvas_oss']);
        $response->assertStatus(200);
        $this->assertTrue($response['data']['name'] == 'TestUpdate');
        $this->assertTrue($response['data']['type'] == 'canvas_oss');
    }

    public function testUpdateProviderPlatformAccessKey()
    {
        $user = \App\Models\User::factory()->admin()->create();
        $providerPlatform = \App\Models\ProviderPlatform::factory()->create();
        $response = $this->actingAs($user)->patch($this->uri.'/'.$providerPlatform->id, ['access_key' => '239842o3jfo233423']);
        $response->assertStatus(200);
        $resp = $this->actingAs($user)->get($this->uri.'/'.$providerPlatform->id.'?show_key=true');
        $resp->assertSuccessful();
        $this->assertEquals($resp['data']['access_key'], '239842o3jfo233423');
    }

    public function testUpdateProviderPlatformUnauthorized()
    {
        $user = \App\Models\User::factory()->create();
        $providerPlatform = \App\Models\ProviderPlatform::factory()->create();
        $response = $this->actingAs($user)->patch($this->uri.'/'.$providerPlatform->id, ['name' => 'TestUpdate']);
        $response->assertStatus(403);
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
