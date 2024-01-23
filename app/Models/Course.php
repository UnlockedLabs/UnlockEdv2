<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Course extends Model
{
    use HasFactory;

    protected $fillable = [
<<<<<<< HEAD:app/Models/Course.php

        'provider_resource_id',
        'provider_course_name',
        'provider_start_at',
        'provider_end_at',
=======
        'provider_platform_id',
        'authentication_provider_id',
        'authentication_type', // openid-connect
>>>>>>> c4b85e6 (fix: progress in permanent auth solutions):app/Models/AuthProviderMapping.php
    ];
}
