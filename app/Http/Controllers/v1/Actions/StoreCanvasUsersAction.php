<?php

namespace App\Http\Controllers\v1\Actions;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\ProviderPlatform;
use App\Models\ProviderUserMapping;
use App\Models\User;
use Illuminate\Http\Request;

class StoreCanvasUsersAction extends Controller
{
    public function __invoke(Request $request)
    {
        $provider = ProviderPlatform::findOrFail($request->provider_platform_id);
        $canvas = $provider->getCanvasServices();
        $users = $canvas->listUsers();
        $new_users = [];
        foreach ($users as $user) {
            // Check if we have the user already by the mapping so we have a unique key
            if ($provider->providerUserMappings()->where('external_user_id', $user['id'])->exists()) {
                continue;
            }
            $user_profile = $canvas->getUserProfile($user['id']);
            $v2_user = User::create([
                'username' => $user['login_id'],
                'email' => $user_profile['email'],
                'name_first' => $user_profile['first_name'],
                'name_last' => $user_profile['last_name'],
                'role' => UserRole::Student,
                'password' => bcrypt('ChangeMe!'),
                'password_reset' => true,
            ]);
            $new_users[] = $v2_user;
            ProviderUserMapping::create([
                'user_id' => $v2_user->id,
                'provider_platform_id' => $provider->id,
                'external_user_id' => $user['id'],
                'external_username' => $user_profile['name'],
            ]);
        }

        return UserResource::collection($new_users);
    }
}
