<?php

namespace App\Http\Resources;

use App\Models\User;
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
        return parent::toArray($request);
    }

    public static function withPassword(User $user, $pw): array
    {
        return [
            'status' => 'success',
            'message' => 'User created. Temporary password set',
            'temp_password' => $pw,
            'user' => $user,
        ];
    }
}
