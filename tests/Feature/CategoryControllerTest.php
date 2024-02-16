<?php

namespace Tests\Feature;

use App\Models\Category;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CategoryControllerTest extends TestCase
{
    use RefreshDatabase;

    public string $uri = '/api/v1/categories';

    public function testGetCategory()
    {
        Category::factory(10)->create();
        $user = \App\Models\User::factory()->admin()->create();

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

    public function testUpdateCategory()
    {
        // create 10 categories, assert they are returned by admin
        Category::factory(10)->create();
        $admin = \App\Models\User::factory()->admin()->create();
        $resp = $this->actingAs($admin)->get($this->uri);
        $resp->assertStatus(200);
        $resp->assertJsonStructure([
            'data' => [
                '*' => [
                    'id',
                    'name',
                    'rank',
                    'links',
                ],
            ],
        ]);
        // make 3 categories, assert that we can post an array of categories
        $categories = Category::factory(3)->make()->toArray();
        $response = $this->actingAs($admin)->put($this->uri, $categories);
        $response->assertStatus(200);
        // assert that a get request returns 3 categories only
        $response = $this->actingAs($admin)->get($this->uri);
        $this->assertCount(3, $response['data']);
    }

    public function testUpdateCategoryAuth()
    {
        $user = \App\Models\User::factory()->create();
        $category = Category::factory(3)->make()->toArray();
        $response = $this->actingAs($user)->put($this->uri, $category);
        $response->assertStatus(403);

        $admin = \App\Models\User::factory()->admin()->create();
        $response = $this->actingAs($admin)->put($this->uri, $category);
        $response->assertStatus(200);
        $response = $this->actingAs($admin)->get($this->uri);
        $this->assertCount(3, $response['data']);
    }
}
