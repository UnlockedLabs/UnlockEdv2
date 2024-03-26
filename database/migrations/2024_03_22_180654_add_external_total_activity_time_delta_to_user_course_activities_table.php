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
        Schema::table('user_course_activities', function (Blueprint $table) {
            $table->unsignedBigInteger('external_total_activity_time_delta')->default(0);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('user_course_activities', function (Blueprint $table) {
            if (Schema::hasColumn('user_course_activities', 'external_total_activity_time_delta')) {
                $table->dropColumn('external_total_activity_time_delta');
            }
        });
    }
};
