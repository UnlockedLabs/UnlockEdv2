<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('auth_provider_mapping', function (Blueprint $table) {
            $table->id();
            $table->timestamps();
            $table->foreign('provider_platform_id')->references('id')->on('provider_platforms');
            $table->integer('authentication_provider_id');
            $table->string('authenticatable_type')->default('openid_connect');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('auth_provider_mapping');
    }
};
