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

        if (env('CANVAS_BASE_URL') && env('CANVAS_API_KEY')) {
            DB::table('provider_platforms')->insert([
                'type' => 'canvas_oss',
                'name' => 'CanvasLMS',
                'description' => 'Canvas LMS Local Instance',
                'icon_url' => 'https://www.instructure.com/images/favicon.ico',
                'account_id' => env('CANVAS_ACCOUNT_ID'),
                'base_url' => env('CANVAS_BASE_URL'),
                'access_key' => env('CANVAS_API_KEY'),
                'state' => ProviderPlatformState::ENABLED,
            ]);
        }
    }
}
