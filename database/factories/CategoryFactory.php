<?php
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
            'name' => $this->faker->word,
            'rank' => $this->faker->numberBetween(1, 10),
            'links' => json_encode([$this->faker->word => $this->faker->word]),
        ];
    }
	
	
}
