<?php

namespace Database\Seeders;

// use Illuminate\Database\Console\Seeds\WithoutModelEvents;

use App\Enums\UserRole;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // This needs to be defaulted and ran every time.. maybe needs to be a migration?
        DB::table('users')->insert([
            'name_first' => 'Super',
            'name_last' => 'Admin',
            'email' => 'preston.thorpe@maine.edu',
            'username' => 'unlock-dev',
            'password' => bcrypt('ChangeMe!'),
            'password_reset' => true,
            'role' => UserRole::Admin,
        ]);
        DB::table('categories')->insert([
            'name' => 'Unlocked Labs',
            'rank' => '1',
            'links' => '["https://www.unlockedlabs.org/"]',
        ]);
    }
}
