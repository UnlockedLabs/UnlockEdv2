<?php

declare(strict_types=1);

// database/factories/CategoryFactory.php

namespace Database\Factories;

use App\Models\Category;
use Illuminate\Database\Eloquent\Factories\Factory;

class CategoryFactory extends Factory
{
    protected $model = Category::class;

    public function definition()
    {
        return [
            'id' => $this->faker->unique()->numberBetween(1, 1000000), // Example: Generate a unique ID between 1 and 100
            'name' => $this->faker->word,
            'rank' => $this->faker->numberBetween(1, 10),
            'links' => ['link1' => $this->faker->url, 'link2' => $this->faker->url],
        ];
    }
}
