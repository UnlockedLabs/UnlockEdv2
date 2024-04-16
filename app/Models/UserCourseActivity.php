<?php

declare(strict_types=1);

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Class UserCourseActivity
 *
 * @property int $id
 * @property int $user_id
 * @property int $enrollment_id
 * @property int $external_has_activity
 * @property int $external_total_activity_time
 * @property int $external_total_activity_time_delta
 * @property Carbon $date
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class UserCourseActivity extends Model
{
    protected $table = 'user_course_activities';

    use HasFactory;

    protected $fillable = [
        'user_id',
        'enrollment_id',
        'external_has_activity',
        'external_total_activity_time',
        'external_total_activity_time_delta',
        'date',
    ];

    protected $with = ['user', 'enrollment'];

    public function forDate($date): \Illuminate\Database\Eloquent\Collection
    {
        return $this->where('date', $date)->get();
    }

    public function user(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo('\App\Models\User');
    }

    public function enrollment(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo('\App\Models\Enrollment');
    }
}
