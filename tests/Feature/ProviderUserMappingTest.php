<?php

namespace Tests\Feature;

use App\Models\ProviderPlatform;
use App\Models\User;
use Database\Seeders\TestSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProviderUserMappingTest extends TestCase
{
    use RefreshDatabase;

    protected $seeder = TestSeeder::class;

    public $url_beg = '/api/v1/users';

    public $url_end = '/logins';

    /** @test */
    public function it_lists_provider_user_mappings(): void
    {
        $user = User::factory()->admin()->createOne();
        $this->seed($this->seeder);

        $response = $this->actingAs($user)->get('/api/v1/users/logins', [
            'Accept' => 'application/json',
        ]);

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

    public function it_lists_only_users_mappings_non_admin(): void
    {
        $user = User::factory()->createOne();
        $this->seed($this->seeder);
        $response = $this->actingAs($user)->get('/api/v1/users/logins', [
            'Accept' => 'application/json',
        ]);

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
        foreach ($response->json('data') as $mapping) {
            $this->assertEquals($user->id, $mapping['user_id']);
        }
    }

    /** @test */
    public function it_creates_a_provider_user_mapping_successfully()
    {
        $admin = User::factory()->admin()->createOne();
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
        $response = $this->actingAs($admin)->post('/api/v1/users/'.$user->id.'/logins', $data);

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
        $user = User::inRandomOrder()->first();
        $response = $this->actingAs($user)->get("/api/v1/users/$user->id/logins");

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
    public function it_doesnt_provider_user_mappings_for_a_user_non_admin(): void
    {
        $this->seed($this->seeder);
        $user = User::factory()->createOne();
        $user2 = User::factory()->createOne();
        $userId = $user2->id;
        $response = $this->actingAs($user)->get("/api/v1/users/$userId/logins");

        $response->assertStatus(403);
    }

    /** @test */
    public function it_deletes_a_provider_user_mapping(): void
    {
        $user = User::factory()->admin()->createOne();
        $response = $this->actingAs($user)->delete($this->url_beg.'/'.$user->id.$this->url_end);

        $response->assertOk();
    }

    /** @test */
    public function it_wont_delete_a_provider_user_mapping_non_admin(): void
    {
        $user = User::factory()->createOne();
        $response = $this->actingAs($user)->delete($this->url_beg.'/'.$user->id.$this->url_end);

        $response->assertStatus(403);
    }
}
