<?php

namespace Database\Seeders;

// use Illuminate\Database\Console\Seeds\WithoutModelEvents;

use App\Enums\AuthProviderStatus;
use App\Enums\ProviderPlatformState;
use App\Enums\UserRole;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
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
            'role' => UserRole::ADMIN,
        ]);
        DB::table('categories')->insert([
            'name' => 'Unlocked Labs',
            'rank' => '1',
            'links' => '
            [
                {"Unlocked Labs Website":"http://www.unlockedlabs.org/"},
                {"Unlocked Labs LinkedIn":"https://www.linkedin.com/company/labs-unlocked/"}
            ]',
        ]);
        $prov = env('CANVAS_BASE_URL', '');
        if (! empty($prov)) {
            DB::table('provider_platforms')->insert([
                'type' => 'canvas_oss',
                'name' => 'CanvasLMS',
                'description' => 'Canvas LMS Cloud Instance',
                'icon_url' => 'https://www.instructure.com/images/favicon.ico',
                'account_id' => env('CANVAS_ACCOUNT_ID'),
                'base_url' => env('CANVAS_BASE_URL'),
                'access_key' => Crypt::encryptString(env('CANVAS_API_KEY')),
                'state' => ProviderPlatformState::ENABLED,
            ]);
        }
        $usersInfo = env('USERS_INFO', '');
        if (! empty($usersInfo)) {
            $users = explode(';', $usersInfo);

            foreach ($users as $user) {
                $userInfo = str_getcsv($user, ',', "'");

                $userId = DB::table('users')->insertGetId([
                    'username' => $userInfo[0],
                    'email' => $userInfo[1],
                    'name_first' => $userInfo[2],
                    'name_last' => $userInfo[3],
                    'password' => bcrypt('ChangeMe!'),
                    'password_reset' => true,
                    'role' => UserRole::ADMIN,
                ]);
                if (count($userInfo) > 4) {
                    // there is provider info included
                    DB::table('provider_user_mappings')->insert([
                        'user_id' => $userId,
                        'provider_platform_id' => $userInfo[6],
                        'external_user_id' => $userInfo[4],
                        'external_username' => $userInfo[5],
                        'authentication_provider_status' => AuthProviderStatus::OPENID_CONNECT,
                    ]);
                }
            }
        }
    }
}
