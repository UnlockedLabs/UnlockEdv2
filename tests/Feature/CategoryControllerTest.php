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
        $categories = Category::factory(10)->create();

        // Assert that 10 categories were created
        $this->assertCount(10, $categories);
    }

    public function testCategoriesIndexReturnsJson()
    {
        // Create 10 categories using the factory
        Category::factory(2)->create();

        // Make a GET request to the index method
        $response = $this->get($this->uri);

        // Assert that the response status code is 200 (OK)
        $response->assertStatus(200);

        // Assert that the response contains the categories
        $response->assertJsonStructure(['data']);
    }

    public function testGetCategory()
    {
        $category = Category::factory(1)->create();

        $response = $this->get($this->uri.'/'.$category[0]->id);

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

        // this is a change
    }

    public function testUpdateCategory()
    {
        $category = Category::factory(1)->create();
        $response = $this->patch($this->uri.'/'.$category[0]->id, ['name' => 'TestUpdate']);
        $response->assertStatus(200);
        assert($response['data']['name'] == 'TestUpdate');
    }

    public function testDeleteCategory()
    {
        $category = Category::factory(1)->create();
        $response = $this->delete($this->uri.'/'.$category[0]->id);
        $response->assertStatus(204);
    }
}
