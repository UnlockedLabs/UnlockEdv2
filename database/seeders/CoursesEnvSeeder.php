<?php

namespace Database\Seeders;

use App\Models\ProviderPlatform;
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
            // I'd really not like to have to write this again, so might as well commit it.
            // example format: title, description, provider_resource_id, logo, provider_enrollment_id
            // SEED_COURSES='8,"Entrepreneurship 101","Learn to launch and grow innovative business...",5,"https://st3.depositphotos.com/handshake.jpg",13;

            $data = str_getcsv($course, ',', '"');
            $id = DB::table('courses')->insertGetId([
                'description' => $data[2],
                'provider_resource_id' => $data[3],
                'provider_course_name' => $data[1],
                'provider_platform_id' => 1, // might need to be changed
                'img_url' => $data[4],
                'provider_start_at' => '2024-03-05',
                'provider_end_at' => '2024-07-05',
            ]);
            $provider_platform = ProviderPlatform::findOrFail(1);
            $url = "$provider_platform->base_url/courses/$data[3]";
            if (substr($url, 0, 4) !== 'http') {
                $url = "https://$url";
            }
            DB::table('enrollments')->insert([
                'user_id' => 2, // might need to be changed before running this
                'course_id' => $id,
                'provider_user_id' => $data[0],
                'provider_enrollment_id' => $data[5],
                'enrollment_state' => 'active',
                'provider_start_at' => '2024-03-05',
                'provider_end_at' => '2024-07-05',
                'link_url' => $url,
            ]);
        }
    }
}
