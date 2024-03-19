<?php

namespace Database\Seeders;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\ProviderPlatform;
use App\Models\ProviderUserMapping;
use App\Models\User;
use App\Models\UserActivity;
use App\Models\UserCourseActivity;
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
                $enrollment = Enrollment::factory()->forUser($user->id)->forCourse($course->id)->createOne();
                // we need to create activity for each day since the enrollment began
                $date = $enrollment->external_start_at;
                $now = new \DateTimeImmutable('now');
                $random_start_time = rand(1000, 100000);
                while ($date < $now) {
                    $activity = UserCourseActivity::factory()->forDate($date)->forUser($user->id)->forEnrollment($enrollment->id)->makeOne();
                    if (! $activity->has_activity) {
                        $activity['external_total_activity_time'] = $random_start_time;
                        $activity->save();
                    } else {
                        $activity['external_total_activity_time'] = $random_start_time + rand(100, 1000);
                        $activity->save();
                        $random_start_time = $activity->total_activity_time;
                    }
                    $date = $date->add(new \DateInterval('P1D'));
                }
            }
        }
    }
}
