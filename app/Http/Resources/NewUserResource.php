<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NewUserResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     * This should ONLY be returned for a new user.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $this->resource->makeVisible('password');

        return parent::toArray($request);
    }
}
