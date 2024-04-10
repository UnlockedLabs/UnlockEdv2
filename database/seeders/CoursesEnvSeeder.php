<?php

declare(strict_types=1);

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
            // example format: external_user_id, title, description, provider_resource_id, logo, provider_enrollment_id
            // SEED_COURSES='"Entrepreneurship 101","ENT101","Learn to launch and grow innovative business with essential entrepreneurial skills and strategies",5,"https://st3.depositphotos.com/3591429/12631/i/450/depositphotos_126313394-stock-photo-business-of-people-with-handshake.jpg",13,2;"Anger Management","AMGMT101","Develop skills to effectively manage anger: fostering personal growth and stronger relationships",6,"https://www.shutterstock.com/shutterstock/photos/434504767/display_1500/stock-photo-hand-holding-piece-of-jigsaw-puzzle-with-word-anger-management-434504767.jpg",15,2;"Business Analytics","BBA101","Drive strategic decisions by mastering analytical tools that transform data into business insights.",4,"https://t4.ftcdn.net/jpg/01/72/67/07/360_F_172670704_DtUzeuEo8sTFOgNdJgqEtAOKM3YLrgIv.jpg",11,2;"Introduction to Cyber Security","CYSEC101","Master the art of protecting systems and data against complex cyber threat and vulnerability.",3,"https://media.istockphoto.com/id/1331943958/photo/digital-cloud-security-background-concept.jpg?s=612x612&w=0&k=20&c=ktHShoivHgGcXbkgJGUpy6Q5JLYKMGsrbpY0e_4MrSc=",9,2'

            $data = str_getcsv($course, ',', '"');
            $id = DB::table('courses')->insertGetId([
                'description' => $data[2],
                'external_course_code' => $data[1],
                'external_resource_id' => $data[3],
                'external_course_name' => $data[0],
                'provider_platform_id' => 1, // might need to be changed
                'img_url' => $data[4],
            ]);
            $provider_platform = ProviderPlatform::findOrFail(1); // provider platform may need to be changed
            $url = "$provider_platform->base_url/courses/$data[3]";
            if (substr($url, 0, 4) !== 'http') {
                $url = "https://$url";
            }
            DB::table('enrollments')->insert([
                'user_id' => $data[6],
                'course_id' => $id,
                'external_enrollment_id' => $data[5],
                'enrollment_state' => 'active',
                'external_start_at' => '2024-03-05',
                'external_end_at' => '2024-07-05',
                'external_link_url' => $url,
            ]);
        }
    }
}
