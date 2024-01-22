<?php

namespace Database\Seeders;

use App\Models\AuthProviderMapping;
use App\Models\Enrollment;
use App\Models\ProviderPlatform;
use App\Models\ProviderUserMapping;
use App\Models\User;
use Illuminate\Database\Seeder;

class TestSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        User::factory(10)->create();
        ProviderPlatform::factory(10)->create();
        AuthProviderMapping::factory(10)->create();
        Enrollment::factory(10)->create();
        ProviderUserMapping::factory(10)->create();
    }
}
