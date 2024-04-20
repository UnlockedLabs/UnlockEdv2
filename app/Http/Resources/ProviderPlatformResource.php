<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Class ProviderPlatformResource
 *
 * @mixin \App\Models\ProviderPlatform
 */
class ProviderPlatformResource extends JsonResource
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
            'type' => $this->type,
            'name' => $this->name,
            'description' => $this->description,
            'icon_url' => $this->icon_url,
            // don't return an access key unless they call 'show' with the id
            'account_id' => $this->account_id,
            'base_url' => $this->base_url,
            'state' => $this->state,
        ];
    }
}
