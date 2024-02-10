<?php

namespace App\Http\Controllers\v1\Actions;

use App\Http\Controllers\Controller;
use App\Http\Requests\RegisterCanvasAuthProviderRequest;
use App\Models\ProviderPlatform;
use App\Services\CanvasServices;

class RegisterCanvasAuthProviderAction extends Controller
{
    public function register(RegisterCanvasAuthProviderRequest $request)
    {
        $valid = $request->validated();

        $provider = ProviderPlatform::where(['id' => $valid['provider_platform_id']])->firstOrFail();

        if (! $provider || ! in_array($provider->type, ['canvas_cloud', 'canvas_oss'])) {
            return response()->json(['Provider Platform was either not found or is not a Canvas instance', 404]);
        }

        $cs = CanvasServices::byProviderId($provider->id);

        $resp = $cs->createAndRegisterAuthProvider($valid->auth_provider_url);

        if (! array_key_exists('id', $resp)) {
            return response()->json(["Unexpected response from Canvas: $resp", 400]);
        }
        $auth_provider_id = $resp['id'];
        $provider->external_auth_provider_id = $auth_provider_id;
        $provider->update(['external_auth_provider_id' => $auth_provider_id]);
        $provider->save();

        return response()->json(['Success: auth_provider_id' => $auth_provider_id], 200);
    }
}
