<?php

declare(strict_types=1);

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

    public function userCourseActivity()
    {
        return $this->hasMany('App\Models\UserCourseActivity');
    }

    public function allEnrollmentsForProviderUser(int $user_id, int $provider_id)
    {
        return $this->where('user_id', $user_id)
            ->whereHas('course', function ($query) use ($provider_id) {
                $query->where('provider_platform_id', $provider_id);
            })
            ->get();
    }

    public function isForProvider(int $provider_id)
    {
        return $this->course->provider_platform_id == $provider_id;
    }

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
