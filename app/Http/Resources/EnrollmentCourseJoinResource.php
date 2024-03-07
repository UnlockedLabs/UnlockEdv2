<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EnrollmentCourseJoinResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'course_name' => $this->course->provider_course_name,
            'course_description' => $this->course->description,
            'user_id' => $this->user_id,
            'course_id' => $this->course_id,
            'user_name' => $this->user->username,
            'provider_platform_id' => $this->course->provider_platform_id,
            'provider_course_id' => $this->course->provider_resource_id,
            'provider_enrollment_id' => $this->provider_enrollment_id,
            'provider_user_id' => $this->provider_user_id,
            'provider_platform_name' => $this->course->providerPlatform->name,
            'provider_platform_url' => $this->course->providerPlatform->base_url,
            'provider_platform_icon_url' => $this->course->providerPlatform->icon_url,
            'enrollment_state' => $this->enrollment_state,
            'img_url' => $this->course->img_url,
            'link_url' => $this->link_url,
            'provider_start_at' => $this->provider_start_at,
            'provider_end_at' => $this->provider_end_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
