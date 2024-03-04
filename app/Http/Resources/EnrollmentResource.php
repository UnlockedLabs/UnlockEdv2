<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EnrollmentResource extends JsonResource
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
            'course_name' => $this->course()->provider_course_name,
            'course_description' => $this->course()->description,
            'provider_course_id' => $this->course()->provider_course_id,
            'user' => $this->user()->username,
            'provider_platform_name' => $this->providerPlatform()->name,
            'provider_platform_url' => $this->providerPlatform()->base_url,
            'provider_platform_icon_url' => $this->providerPlatform()->icon_url,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
