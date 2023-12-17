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
        User::factory()->create(10);
        ProviderPlatform::factory()->create(10);
    }
}
