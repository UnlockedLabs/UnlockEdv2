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
        'external_enrollment_id',
        'enrollment_state',
        'external_start_at',
        'external_end_at',
        'external_link_url',
    ];

    protected $casts = [
        'external_start_at' => 'datetime',
        'external_end_at' => 'datetime',
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
