<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Enrollment extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'course_id',
        'provider_id',
        'provider_user_id',
        'provider_course_id',
        'enrollment_state',
        'links',
        'provider_start_at',
        'provider_end_at',
    ];

    protected $casts = [
        'links' => 'json',
        'provider_start_at' => 'datetime',
        'provider_end_at' => 'datetime',
    ];
}
