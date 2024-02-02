<?php

namespace App\Http\Controllers\v1\Actions;

use App\Http\Controllers\Controller;
use App\Models\ProviderPlatform;
use App\Models\User;
use App\Services\CanvasServices;
use Illuminate\Http\Request;

class CreateCanvasUserLogin extends Controller
{
    public function create_canvas_login(Request $request)
    {
        $valid = $request->validated(['user_id' => 'required|integer|exists:users,id', 'provider_platform_id' => 'required|integer|exists:provider_platforms,id']);
        $user = User::findOrFail($valid['user_id']);
        $provider = ProviderPlatform::findOrFail($valid['provider_platform_id']);

        if ((! in_array($provider->type, ['canvas_oss', 'canvas_cloud'])) || ($provider->external_auth_provider_id == null)) {
            return response()->json(['error' => 'Invalid provider type or provider is not registered'], 400);
        }

        $mapping = $user->providerUserMappings()->where('provider_platform_id', $provider->id)->first();
        if ($mapping == null) {
            return response()->json(['error' => 'User is not registered with this provider'], 400);
        }
        $canvasService = CanvasServices::byProviderId($provider);
        $response = $canvasService->createUserLogin($mapping->external_user_id);

        if ($response['error'] != null) {
            return response()->json(['error' => $response['message']], 400);
        } else {
            $login_id = $response['id'];

            return response()->json(['message' => 'Success', 'login_id' => $login_id], 200);
        }
    }
}
