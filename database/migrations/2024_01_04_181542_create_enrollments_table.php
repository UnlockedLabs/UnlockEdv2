<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateEnrollmentsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('enrollments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id');
            $table->foreignId('course_id');
            $table->string('provider_user_id');
            $table->string('provider_course_id');
            $table->string('provider_id');
            $table->enum('enrollment_state', ['active', 'inactive', 'completed', 'deleted']);
            $table->json('links');
            $table->timestamp('provider_start_at')->nullable();
            $table->timestamp('provider_end_at')->nullable();
            $table->timestamps();
        });

    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('enrollments');
    }
}
