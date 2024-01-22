<?php

namespace Database\Seeders;

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
            'email' => 'preston.thorpe@maine.edu',
            'username' => 'preston.thorpe@maine.edu',
            'password' => bcrypt('PThorpe92'),
            'password_reset' => false,
            'role' => UserRole::Admin,
        ]);
    }
}
