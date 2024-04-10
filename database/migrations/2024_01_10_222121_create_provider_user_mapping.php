<?php

declare(strict_types=1);

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
        Schema::create('provider_user_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id');
            $table->foreignId('provider_platform_id');
            $table->string('external_user_id');
            $table->string('external_username');
            $table->enum('authentication_provider_status', ['none', 'openid_connect'])->default('none');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('provider_user_mappings');
    }
};
