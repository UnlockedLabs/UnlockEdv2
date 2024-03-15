<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserCourseActivity extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'enrollment_id',
        'external_has_activity',
        'external_total_activity_time',
        'date',
    ];

    public function forDate($date)
    {
        return $this->where('date', $date)->get();
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function enrollment()
    {
        return $this->belongsTo(Enrollment::class);
    }
}
