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

    protected $with = ['course'];

    protected $casts = [
        'external_start_at' => 'datetime',
        'external_end_at' => 'datetime',
    ];

    /**
     * Get the user course activities for the enrollment.
     */
    public function userCourseActivity(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany('\App\Models\UserCourseActivity');
    }

    /**
     * Get all enrollments for a provider user.
     */
    public static function forProviderUser(int $provider_id, int $user_id): array
    {
        return self::with('course')
            ->where('user_id', $user_id)
            ->whereHas('course', function ($query) use ($provider_id) {
                $query->where('provider_platform_id', $provider_id);
            })
            ->get()->toArray();
    }

    /**
     * Check if the enrollment is for the provider.
     */
    public function isForProvider(int $provider_id): bool
    {
        return $this->course()->getForeignKeyName() == $provider_id;
    }

    /**
     * Get the course that owns the enrollment.
     */
    public function course(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo('\App\Models\Course');
    }

    /**
     * Get the user that owns the enrollment.
     */
    public function user(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo('\App\Models\User');
    }
}
