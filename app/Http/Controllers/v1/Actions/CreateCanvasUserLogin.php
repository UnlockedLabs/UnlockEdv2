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
        $valid = $request->validate(['user_id' => 'required|integer|exists:users,id', 'provider_platform_id' => 'required|integer|exists:provider_platforms,id']);
        try {
            $user = User::findOrFail($valid['user_id']);
            $provider = ProviderPlatform::findOrFail($valid['provider_platform_id']);
        } catch (\Exception) {
            return response()->json(['error' => 'User or Provider not found'], 404);
        }
        $canvasService = CanvasServices::byProviderId($provider->id);

        $response = $canvasService->createUserLogin($user->id);
        $response = $response->content();
        $response = json_decode($response, true);

        if ($response['error'] != null) {
            return response()->json(['error' => $response['message']], 400);
        } else {
            $login_id = $response['data']['id'];
            $mapping = $user->providerUserMappings()->where(['provider_platform_id' => $provider->id]);
            $mapping->update(['external_login_id' => $login_id])->save();

            return response()->json(['message' => 'Success', 'login_id' => $login_id], 200);
        }
    }
}
