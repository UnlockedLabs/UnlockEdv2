<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Course extends Model
{
    use HasFactory;

    protected $fillable = [
        'provider_resource_id',
        'description',
        'provider_course_name',
        'provider_start_at',
        'provider_end_at',
    ];

    public function providerPlatform()
    {
        return $this->belongsTo(ProviderPlatform::class);
    }

    public function enrollments()
    {
        return $this->hasMany(Enrollment::class);
    }
}
