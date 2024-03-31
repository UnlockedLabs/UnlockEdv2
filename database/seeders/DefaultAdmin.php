<?php

declare(strict_types=1);

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
            'role' => UserRole::ADMIN,
        ]);
        DB::table('provider_platforms')->insert([
            'type' => ProviderPlatformType::CANVAS_OSS->value,
            'name' => 'Canvas',
            'description' => 'Canvas LMS',
            'icon_url' => 'https://www.instructure.com/themes/custom/instructure_bootstrap/logo.svg',
            'account_id' => 1,
            'access_key' => Crypt::encryptString(env('CANVAS_API_KEY')),
            'base_url' => env('CANVAS_BASE_URL'),
            'state' => ProviderPlatformState::ENABLED,
        ]);
    }
}
