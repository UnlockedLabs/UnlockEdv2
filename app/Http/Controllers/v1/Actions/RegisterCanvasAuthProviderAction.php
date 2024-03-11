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

        $provider = ProviderPlatform::findOrFail($valid['provider_platform_id'])->firstOrFail();

        if (! $provider || ! in_array($provider->type->value, ['canvas_cloud', 'canvas_oss'])) {
            return response()->json(['Provider Platform was either not found or is not a Canvas instance', 404]);
        }
        $cs = CanvasServices::byProviderId($provider->id);
        $resp = $cs->createAndRegisterAuthProvider($valid['auth_provider_url'])->content();
        $resp = json_decode($resp, true);
        $data = $resp['data'];

        if (! isset($data['id'])) {
            $err = $resp['error'] ?? 'External error';
            $msg = $resp['message'] ?? 'Unexpected response from Canvas';

            return response()->json(["$err: $msg", 400]);
        }
        $auth_provider_id = $data['id'];
        $provider->update(['external_auth_provider_id' => $auth_provider_id]);
        $provider->save();

        return response()->json(['Success: auth_provider_id' => $auth_provider_id], 200);
    }
}
