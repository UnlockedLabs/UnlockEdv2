<?php

namespace Tests\Feature;

use App\Models\Category;
use Database\Factories\CategoryFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\Withfaker;
use Tests\TestCase;

class CategoryControllerTest extends TestCase
{
    use RefreshDatabase;

	public function testCategoriesAreCreated()
	{
        // Create 10 categories using the factory
        $categories = Category::factory(10)->create();

        // Assert that 10 categories were created
        $response = $this->assertCount(10, $categories);
	}


	public function testCategoriesIndexReturnsJson()
	{
        // Use fake to generate dummy categories with names
		Category::factory(10)->create();
		
		// Make a GET request to the index method
		$response = $this->get('/api/categories');

		// Assert that the response status code is 200 (OK)
		$response->assertStatus(200);

		// Assert that the response contains the categories
		$response->assertJsonIsArray();
	}
	
}
