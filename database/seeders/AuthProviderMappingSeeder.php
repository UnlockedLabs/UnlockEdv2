<?php

namespace Database\Seeders;

use App\Models\AuthProviderMapping;
use Illuminate\Database\Seeder;

class AuthProviderMappingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        AuthProviderMapping::factory()->createMany(10);
    }
}
