<?php

namespace App\Http\Controllers;

use App\Http\Resources\AuthProviderMappingResource;
use App\Models\AuthProviderMapping;
use Illuminate\Http\Request;

class AuthProviderMappingController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'provider_platform_id' => 'required|integer',
            'authenication_provider_id' => 'required|string',
            'authentication_type' => 'required|string',
        ]);

        $authProviderMapping = AuthProviderMapping::create($validated);

        return response()->json($authProviderMapping, 201);
    }

    public function index()
    {
        $providers = AuthProviderMapping::all();

        return AuthProviderMappingResource::collection($providers);
    }

    public function show(string $providerId): AuthProviderMappingResource
    {
        $provider = AuthProviderMapping::with('provider_platform_id', $providerId)->firstOrFail();

        return new AuthProviderMappingResource($provider);
    }

    public function delete(string $id)
    {
        $provider = AuthProviderMapping::findOrFail($id);
        $provider->delete();

        return response()->json(null, 204);
    }
}
