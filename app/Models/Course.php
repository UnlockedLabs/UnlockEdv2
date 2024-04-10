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

    public function hasEnrollmentForUser($user_id): bool
    {
        return $this->enrollments()->where('user_id', $user_id)->exists();
    }

    public function providerPlatform()
    {
        return $this->belongsTo(ProviderPlatform::class);
    }

    public function enrollments()
    {
        return $this->hasMany(Enrollment::class);
    }
}
