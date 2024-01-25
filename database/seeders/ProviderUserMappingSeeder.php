<?php

namespace Database\Seeders;

use App\Models\ProviderUserMapping;
use Illuminate\Database\Seeder;

class ProviderUserMappingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        ProviderUserMapping::factory(10)->create();
    }
}
