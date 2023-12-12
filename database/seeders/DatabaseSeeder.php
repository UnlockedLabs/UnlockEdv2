<?php

namespace Database\Seeders;

// use Illuminate\Database\Console\Seeds\WithoutModelEvents;

use App\Models\ProviderPlatform;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // This is the test data, but we will add the default admin here as well.
        User::factory(10)->create();

        ProviderPlatform::factory(10)->create();

        DB::table('users')->insert([
            'name_first' => 'Super',
            'name_last' => 'Admin',
            'email' => 'admin@unlocked.v2',
            'username' => 'SuperAdmin',
            'password' => bcrypt('ChangeMe!'),
            'password_reset' => true,
        ]);
    }
}
