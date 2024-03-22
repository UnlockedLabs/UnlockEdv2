<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserActivityMapResource extends JsonResource
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
            'date' => $this->date,
            'active_course_count' => $this->active_course_count,
            'total_activity_time' => $this->total_activity_time,
            'total_activity_time_quartile' => $this->total_activity_time_quartile,
        ];
    }
}
