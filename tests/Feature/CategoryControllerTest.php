<?php

namespace Tests\Feature;

use App\Models\Category;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CategoryControllerTest extends TestCase
{
    use RefreshDatabase;

    public string $uri = '/api/v1/categories';

    public function testCategoriesAreCreated()
    {
        // Create 10 categories using the factory
        Category::factory(10)->create();
        $user = \App\Models\User::factory()->create();

        $response = $this->actingAs($user)->get($this->uri);

        $response->assertStatus(200);

        $this->assertCount(10, $response['data']);
        $response->assertJsonIsArray('data');
        $response->assertJsonStructure([
            'data' => [
                '*' => [
                    'id',
                    'name',
                    'rank',
                    'links',
                ],
            ],
        ]);
    }

    public function testCategoriesIndexReturnsJson()
    {
        $user = \App\Models\User::factory()->create();
        // Create 10 categories using the factory
        $category = Category::factory(2)->create();

        $response = $this->actingAs($user)->get($this->uri.'/'.$category[0]->id);

        $response->assertStatus(200);

        $jsonResponse = $response->json();

        // Assert that the response contains the category
        foreach ($jsonResponse as $key => $value) {
            // Skip keys 'created_at' and 'updated_at'
            if (in_array($key, ['created_at', 'updated_at'])) {
                continue;
            }
            assert($value, $category[0]->$key);
        }
        $response->assertStatus(200);

        // Assert that the response contains the categories
        $response->assertJsonStructure(['data']);
    }

    public function testGetCategory()
    {
        $user = \App\Models\User::factory()->create();
        $category = Category::factory(1)->create();

        $response = $this->actingAs($user)->get($this->uri.'/'.$category[0]->id);

        $response->assertStatus(200);

        // Decode the JSON response
        $jsonResponse = $response->json();

        // Assert that the response contains the category
        foreach ($jsonResponse as $key => $value) {
            // Skip keys 'created_at' and 'updated_at'
            if (in_array($key, ['created_at', 'updated_at'])) {
                continue;
            }

            assert($value, $category[0]->$key);
        }
    }

    public function testUpdateCategory()
    {
        $user = \App\Models\User::factory()->create();
        $category = Category::factory(1)->create();
        $response = $this->actingAs($user)->patch($this->uri.'/'.$category[0]->id, ['name' => 'TestUpdate']);
        $response->assertStatus(200);
        assert($response['data']['name'] == 'TestUpdate');
    }

    public function testDeleteCategory()
    {
        $user = \App\Models\User::factory()->create();
        $category = Category::factory(1)->create();
        $response = $this->actingAs($user)->delete($this->uri.'/'.$category[0]->id);
        $response->assertStatus(204);
    }
}
