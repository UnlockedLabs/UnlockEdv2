<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Course extends Model
{
    use HasFactory;

    protected $fillable = [
        'external_resource_id',
        'external_course_code',
        'description',
        'provider_platform_id',
        'external_course_name',
        'img_url',
    ];

    public function hasEnrollmentForUser(int $user_id): bool
    {
        return $this->enrollments()->getQuery()->where('user_id', $user_id)->exists();
    }

    /**
     * Get the provider platform that owns the course.
     */
    public function providerPlatform(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo('\App\Models\ProviderPlatform');
    }

    /**
     * Get the enrollments for the course.
     */
    public function enrollments(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany('\App\Models\Enrollment');
    }
}
