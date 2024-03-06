<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CoursesEnvSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $course_info = env('SEED_COURSES', '');
        $courses = explode(';', $course_info);
        foreach ($courses as $course) {
            // This is for adding courses and enrollments in an testing environment.
            // due to the tricky nature of json, we have to use * for our double quotes in the env file.
            // I'd really not like to have to write this again, so might as well commit it.
            // example format: title, description, provider_resource_id, logo, provider_enrollment_id
            // SEED_COURSES='"8,Entrepreneurship 101","Learn to launch and grow innovative business...",5,{*logo*: *https://st3.depositphotos.com/handshake.jpg*},13;

            $data = str_getcsv($course, ',', '"');
            $json = str_replace('*', '"', $data[4]);
            $id = DB::table('courses')->insertGetId([
                'description' => $data[2],
                'provider_resource_id' => $data[3],
                'provider_course_name' => $data[1],
                'provider_platform_id' => 1, // might need to be changed
                'provider_start_at' => '2024-03-05',
                'provider_end_at' => '2024-07-05',
            ]);

            DB::table('enrollments')->insert([
                'user_id' => 2, // might need to be changed before running this
                'course_id' => $id,
                'provider_user_id' => $data[0],
                'provider_enrollment_id' => $data[4],
                'enrollment_state' => 'active',
                'links' => $json,
                'provider_start_at' => '2024-03-05',
                'provider_end_at' => '2024-07-05',
            ]);
        }
    }
}
