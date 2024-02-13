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

    public function testActuallyCreateCategoryInsteadOfTestThatTheFactoryWorks()
    {
        $user = \App\Models\User::factory()->admin()->create();
        $category = [
            'name' => 'testCategory',
            'rank' => '42',
            'links' => ['self' => 'http://localhost:8000/api/v1/categories/1'],
        ];
        $response = $this->actingAs($user)->post($this->uri, $category);
        $response->assertStatus(200);
    }

    public function testActuallyCreateCategoryInsteadOfTestThatTheFactoryWorksUnauthorized()
    {
        $user = \App\Models\User::factory()->create();
        $category = [
            'name' => 'testCategory',
            'rank' => '42',
            'links' => '{"self": "http://localhost:8000/api/v1/categories/1"}',
        ];
        $response = $this->actingAs($user)->post($this->uri, $category);
        $response->assertStatus(403);
    }

    public function testCategoriesIndexReturnsJson()
    {
        $user = \App\Models\User::factory()->create();
        // Create 10 categories using the factory
        $category = Category::factory(2)->create();

        $response = $this->actingAs($user)->get($this->uri.'/'.$category[0]->id);
        $response->assertStatus(200);
        $data = $response->json()['data'];
        foreach ($data as $key => $value) {
            if (in_array($key, ['created_at', 'updated_at'])) {
                continue;
            }
            $this->assertEquals($value, $category[0][$key]);
        }
        $response->assertStatus(200);

        $response->assertJsonStructure(['data']);
    }

    public function testUpdateCategory()
    {
        $user = \App\Models\User::factory()->admin()->create();
        $category = Category::factory(1)->create();
        $response = $this->actingAs($user)->patch($this->uri.'/'.$category[0]->id, ['name' => 'TestUpdate']);
        $response->assertStatus(200);
        $this->assertTrue($response['data']['name'] == 'TestUpdate');
    }

    public function testUpdateCategoryUnauthorized()
    {
        $user = \App\Models\User::factory()->create();
        $category = Category::factory(1)->create();
        $response = $this->actingAs($user)->patch($this->uri.'/'.$category[0]->id, ['name' => 'TestUpdate']);
        $response->assertStatus(403);
    }

    public function testDeleteCategory()
    {
        $user = \App\Models\User::factory()->admin()->create();
        $category = Category::factory(1)->create();
        $response = $this->actingAs($user)->delete($this->uri.'/'.$category[0]->id);
        $response->assertStatus(204);
    }

    public function testDeleteCategoryUnauthorized()
    {
        $user = \App\Models\User::factory()->create();
        $category = Category::factory(1)->create();
        $response = $this->actingAs($user)->delete($this->uri.'/'.$category[0]->id);
        $response->assertStatus(403);
    }
}
