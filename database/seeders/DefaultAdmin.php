<?php

namespace Database\Seeders;

use App\Enums\ProviderPlatformState;
use App\Enums\ProviderPlatformType;
use App\Enums\UserRole;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Crypt;
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
        DB::table('provider_platforms')->insert([
            'type' => ProviderPlatformType::CANVAS_OSS,
            'name' => 'Canvas',
            'description' => 'Canvas LMS',
            'icon_url' => 'https://www.instructure.com/themes/custom/instructure_bootstrap/logo.svg',
            'account_id' => env('CANVAS_ACCOUNT_ID'),
            'access_key' => Crypt::encryptString(env('CANVAS_API_KEY')),
            'base_url' => env('CANVAS_BASE_URL'),
            'state' => ProviderPlatformState::ENABLED,
        ]);
    }
}
