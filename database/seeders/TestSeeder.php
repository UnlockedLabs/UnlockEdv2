<?php

namespace Database\Seeders;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\ProviderPlatform;
use App\Models\ProviderUserMapping;
use App\Models\User;
use App\Models\UserActivity;
use Illuminate\Database\Seeder;

class TestSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // create 10 users and 3 providers, establish a relationship between them
        $provider = ProviderPlatform::factory()->createOne();
        // Create 5 courses and 10 users for mapped to provider
        $users = User::factory(10)->create();
        $courses = Course::factory(5)->forProviderPlatform($provider->id)->create();
        foreach ($users as $user) {
            ProviderUserMapping::factory()->forUser($user->id)->forProvider($provider->id)->createOne();
            // Create a relationship between each user and provider with a ProviderUserMapping
            UserActivity::factory(5)->forUser($user->id)->createOne();
            // create an enrollment for each user and course
            foreach ($courses as $course) {
                Enrollment::factory()->forUser($user->id)->forCourse($course->id)->createOne();
            }
        }
    }
}
