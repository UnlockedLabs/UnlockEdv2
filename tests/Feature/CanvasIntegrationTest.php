<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Course;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DefaultAdmin;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CanvasIntegrationTests extends TestCase
{
    use RefreshDatabase;

    public $PROV_ID = 1;

    public $USER_ID = 2;

    /**
     * A basic feature test example.
     */
    public function test_fetching_courses_and_enrollments(): void
    {
        /* these tests require the following environment variables to be set, and must ONLY be used with the canvas.unlockedlabs.xyz instance */

        /* USERS_INFO="chrisS,chris@unlockedlabs.org,Chris,Santillan,8,chris@unlockedlabs.org,1;nokieR,nokie@unlockedlabs.org,Nokie,Rae,10,nokie@unlockedlabs.org,1;prestonT,preston@unlockedlabs.org,Preston,Thorpe,1,preston@unlockedlabs.org,1;coleD,cole@unlockedlabs.org,Cole,Dykstra,7,cole@unlockedlabs.net,1" */
        /* SEED_COURSES='"Entrepreneurship 101","ENT101","Learn to launch and grow innovative business with essential entrepreneurial skills and strategies",5,"https://st3.depositphotos.com/3591429/12631/i/450/depositphotos_126313394-stock-photo-business-of-people-with-handshake.jpg",13,2;"Anger Management","AMGMT101","Develop skills to effectively manage anger: fostering personal growth and stronger relationships",6,"https://www.shutterstock.com/shutterstock/photos/434504767/display_1500/stock-photo-hand-holding-piece-of-jigsaw-puzzle-with-word-anger-management-434504767.jpg",15,2;"Business Analytics","BBA101","Drive strategic decisions by mastering analytical tools that transform data into business insights.",4,"https://t4.ftcdn.net/jpg/01/72/67/07/360_F_172670704_DtUzeuEo8sTFOgNdJgqEtAOKM3YLrgIv.jpg",11,2;"Introduction to Cyber Security","CYSEC101","Master the art of protecting systems and data against complex cyber threat and vulnerability.",3,"https://media.istockphoto.com/id/1331943958/photo/digital-cloud-security-background-concept.jpg?s=612x612&w=0&k=20&c=ktHShoivHgGcXbkgJGUpy6Q5JLYKMGsrbpY0e_4MrSc=",9,2' */
        /* CANVAS_BASE_URL=https://canvas.unlockedlabs.xyz */
        /* CANVAS_ACCOUNT_ID=1 */
        /* CANVAS_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx */

        $this->seed(DatabaseSeeder::class);
        // The env variable will put Chris as user 2.
        // Chris is enrolled in all the courses on the Canvas instance
        // with provider_id = 1
        $admin = User::findOrFail(1);
        $proc = [
            'provider_platform_id' => $this->PROV_ID,
        ];
        $users = User::all();
        $courses = $this->actingAs($admin)->post('api/v1/actions/store-user-courses', $proc);
        $courses->assertSuccessful();
        $courses->assertJsonCount(4);

        $enroll = [
            'user_id' => $this->USER_ID,
            'provider_platform_id' => $this->PROV_ID,
        ];
        $enrollments = $this->actingAs($admin)->post('api/v1/actions/store-user-enrollments', $enroll);
        // We hit both actions endpoints to trigger pulling the courses, then the enrollments.
        // now we assert the data is stored and matches the expected data from the env vars
        $course_info = env('SEED_COURSES', '');
        $courses = explode(';', $course_info);
        foreach ($courses as $course) {
            $data = str_getcsv($course, ',', '"');
            $stored_course = Course::where(['external_course_code' => $data[1]])->first();
            $this->assertNotNull($stored_course); // assert the course was stored

            $enrollment = $stored_course->enrollments()->where('user_id', $this->USER_ID)->first();
            $this->assertNotNull($enrollment); // assert the enrollment was stored
            $this->assertEquals($enrollment->external_enrollment_id, $data[5]);
        }
    }

    public function test_fetching_users_from_canvas(): void
    {
        // make sure db has the default admin so user id's line up
        $this->seed(DefaultAdmin::class);
        $admin = User::findOrFail(1);
        $req = [
            'provider_platform_id' => $this->PROV_ID,
        ];
        $resp = $this->actingAs($admin)->postJson('api/v1/actions/store-canvas-users', $req);
        $resp->assertSuccessful();
        $users = User::where(['role' => UserRole::Student])->get();
        foreach ($users as $user) {
            // assert each has a provider mapping, and that they exist
            $this->assertNotNull($user->externalIdFor($this->PROV_ID));
        }
    }
}
