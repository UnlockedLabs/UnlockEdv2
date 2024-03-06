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
        Schema::table('enrollments', function (Blueprint $table) {
            $table->dropColumn('provider_platform_id');
            $table->integer('provider_user_id')->change();
            $table->dropColumn('provider_course_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('enrollments', function (Blueprint $table) {
            $table->string('provider_platform_id');
            $table->string('provider_user_id')->change();
            $table->string('provider_course_id');
        });
    }
};
