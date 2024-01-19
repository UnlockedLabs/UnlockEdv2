<?php

namespace Database\Seeders;

use App\Models\ProviderPlatform;
use App\Models\User;
use Illuminate\Database\Seeder;

class TestSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        User::factory()->createMany(10);
        ProviderPlatform::factory()->createMany(10);
    }
}
