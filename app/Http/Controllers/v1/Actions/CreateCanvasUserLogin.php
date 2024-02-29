<?php

namespace App\Http\Controllers\v1\Actions;

use App\Http\Controllers\Controller;
use App\Models\ProviderPlatform;
use App\Services\CanvasServices;
use Illuminate\Http\Request;

class CreateCanvasUserLogin extends Controller
{
    public function create_canvas_login(Request $request)
    {
        $valid = $request->validated(['user_id' => 'required|integer|exists:users,id', 'provider_platform_id' => 'required|integer|exists:provider_platforms,id']);
        $provider = ProviderPlatform::findOrFail($valid['provider_platform_id']);

        if ($provider->type != 'canvas_oss' || $provider->type != 'canvas_cloud') {
            return response()->json(['error' => 'Invalid provider'], 400);
        }
        $canvasService = CanvasServices::byProviderId($provider);

        $response = $canvasService->createUserLogin($valid['user_id']);

        if ($response['error'] != null) {
            return response()->json(['error' => $response['message']], 400);
        } else {
            $login_id = $response['id'];

            return response()->json(['message' => 'Success', 'login_id' => $login_id], 200);
        }
    }
}
