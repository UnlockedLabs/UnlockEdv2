<?php

namespace Database\Seeders;
use App\Models\Courses;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class CoursesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        //
        Courses::factory(10)->create(); // Create 10 Provider Platforms using the factory
    }
}
