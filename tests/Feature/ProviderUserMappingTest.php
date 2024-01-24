<?php

namespace Tests\Feature;

use App\Models\ProviderPlatform;
use App\Models\User;
use Database\Seeders\ProviderUserMappingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProviderUserMappingTest extends TestCase
{
    use RefreshDatabase;

    protected $seeder = ProviderUserMappingSeeder::class;

    public $url_beg = '/api/v1/users';

    public $url_end = '/logins';

    /** @test */
    public function it_lists_provider_user_mappings()
    {
        $this->seed($this->seeder);

        $response = $this->get('/api/v1/users/logins', [
            'Accept' => 'application/json',
        ]);

        // Assertions
        $response->assertOk();
        dump($response->getContent());
        $response->dump();
    }

    /** @test */
    public function it_creates_a_provider_user_mapping_successfully()
    {
        $this->seed($this->seeder);
        $user = User::factory()->createOne();
        $providerPlatform = ProviderPlatform::factory()->createOne();
        $data = [
            'user_id' => $user->id,
            'provider_platform_id' => $providerPlatform->id,
            'external_user_id' => '1234567890',
            'external_username' => 'johndoe',
            'authentication_provider_status' => 'openid_connect',
        ];

        // Make a POST request to the create method
        $response = $this->post('/api/v1/users/'.$user->id.'/logins', $data);

        // Assertions
        $response->assertStatus(201);
        $response->assertJsonStructure([
            'data' => [
                'user_id',
                'provider_platform_id',
                'external_user_id',
                'external_username',
                'authentication_provider_status',
            ],
        ]);
    }

    /** @test */
    public function it_shows_provider_user_mappings_for_a_user()
    {
        $this->seed($this->seeder);
        $user = User::factory()->createOne();
        $userId = $user->id;
        $response = $this->get("/api/v1/users/$userId/logins");

        // Assertions
        $response->assertOk();
        $response->assertJsonStructure([
            'data' => [
                '*' => [
                    'user_id',
                    'provider_platform_id',
                    'external_user_id',
                    'external_username',
                    'authentication_provider_status',
                ],
            ],
        ]);
    }

    /** @test */
    public function it_deletes_a_provider_user_mapping()
    {
        $user = User::factory()->createOne();
        $response = $this->delete($this->url_beg.'/'.$user->id.$this->url_end);

        $response->assertOk();
    }
}
