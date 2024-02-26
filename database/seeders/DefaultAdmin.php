<?php

namespace Database\Seeders;

use App\Enums\ProviderPlatformState;
use App\Enums\UserRole;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DefaultAdmin extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('users')->insert([
            'name_first' => 'Super',
            'name_last' => 'Admin',
            'email' => 'admin@unlocked.v2',
            'username' => 'SuperAdmin',
            'password' => bcrypt('ChangeMe!'),
            'password_reset' => true,
            'role' => UserRole::Admin,
        ]);

        if (env('CANVAS_BASE_URL') != null && env('CANVAS_API_KEY') != null) {
            DB::table('provider_platforms')->insert([
                'type' => 'canvas_oss',
                'name' => 'CanvasLMS',
                'description' => 'Canvas LMS Cloud Instance',
                'icon_url' => 'https://www.instructure.com/images/favicon.ico',
                'account_id' => env('CANVAS_ACCOUNT_ID'),
                'base_url' => env('CANVAS_BASE_URL'),
                'access_key' => env('CANVAS_API_KEY'),
                'state' => ProviderPlatformState::ENABLED,
            ]);
        }

        $usersInfo = env('USERS_INFO', '');
        if (! empty($usersInfo)) {
            $users = explode(';', $usersInfo);

            foreach ($users as $user) {
                $userInfo = str_getcsv($user, ',', "'");

                if (count($userInfo) == 4) {
                    DB::table('users')->insert([
                        'username' => $userInfo[0],
                        'email' => $userInfo[1],
                        'name_first' => $userInfo[2],
                        'name_last' => $userInfo[3],
                        'password' => bcrypt('ChangeMe!'),
                        'password_reset' => true,
                        'role' => UserRole::Admin,
                    ]);
                }
            }
        }
    }
}
