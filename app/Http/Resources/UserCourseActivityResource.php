<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserCourseActivityResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'user_id' => $this->user_id,
            'username' => $this->user->username,
            'course_name' => $this->enrollment->course->external_course_name,
            'enrollment_id' => $this->enrollment_id,
            'total_time' => $this->external_total_activity_time,
            'has_activity' => $this->external_has_activity,
            'date' => $this->date,
            'provider_platform_id' => $this->enrollment->course->provider_platform_id,
        ];
    }
}
