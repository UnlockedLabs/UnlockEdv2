<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Class UserActivityResource
 *
 * @mixin \App\Models\UserActivity
 * @mixin \App\Models\User
 **/
class UserActivityResource extends JsonResource
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
            'user_id' => $this->user_id,
            'user_name_first' => $this->user->name_first,
            'user_name_last' => $this->user->name_last,
            'browser_name' => $this->browser_name,
            'platform' => $this->platform,
            'device' => $this->device,
            'ip' => $this->ip,
            'clicked_url' => $this->clicked_url,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
