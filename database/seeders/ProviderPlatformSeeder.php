<?php

namespace Database\Seeders;

use App\Models\ProviderPlatform;
use Illuminate\Database\Seeder;

class ProviderPlatformSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        ProviderPlatform::factory(10)->create(); // Create 10 Provider Platforms using the factory
    }
}
