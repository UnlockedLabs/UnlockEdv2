<?php

namespace Database\Seeders;

use App\Enums\ProviderPlatformState;
use App\Enums\ProviderPlatformType;
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

        DB::table('provider_platforms')->insert([
            'id' => '1',
            'type' => ProviderPlatformType::CANVAS_OSS,
            'name' => 'Canvas',
            'description' => 'CanvsLMS test instance',
            'icon_url' => 'https://www.instructure.com/themes/custom/instructure_bootstrap/logo.svg',
            'account_id' => '2',
            'access_key' => '4uiF6Eg7hMUtypxFklCZ4E6A0eDZjNJodAvNcDkZZJVlqx5pVw4y4DfIiYLv7NrK',
            'base_url' => 'http://172.16.20.41',
            'state' => ProviderPlatformState::ENABLED,
        ]);
    }
}
