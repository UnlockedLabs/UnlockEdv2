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
            'course_name' => $this->course->external_course_name,
            'course_code' => $this->course->external_course_code,
            'course_description' => $this->course->description,
            'user_id' => $this->user_id,
            'course_id' => $this->course_id,
            'user_name' => $this->user->username,
            'provider_platform_id' => $this->course->provider_platform_id,
            'external_course_id' => $this->course->external_resource_id,
            'external_enrollment_id' => $this->external_enrollment_id,
            'external_user_id' => $this->user->externalIdFor($this->course->provider_platform_id),
            'provider_platform_name' => $this->course->providerPlatform->name,
            'provider_platform_url' => $this->course->providerPlatform->base_url,
            'provider_platform_icon_url' => $this->course->providerPlatform->icon_url,
            'enrollment_state' => $this->enrollment_state,
            'img_url' => $this->course->img_url,
            'external_link_url' => $this->external_link_url,
            'external_start_at' => $this->external_start_at,
            'external_end_at' => $this->external_end_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
