<?php

namespace App\Http\Controllers\v1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminRequest;
use App\Http\Requests\StoreProviderPlatformRequest;
use App\Http\Requests\UpdateProviderPlatformRequest;
use App\Http\Resources\ProviderPlatformAccessKeyResource;
use App\Http\Resources\ProviderPlatformResource;
use App\Models\ProviderPlatform;

class ProviderPlatformController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(AdminRequest $request)
    {
        $request->authorize();
        $providerPlatforms = ProviderPlatform::all();

        return ProviderPlatformResource::collection($providerPlatforms);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreProviderPlatformRequest $request)
    {
        try {
            $providerPlatform = $request->validated();
        } catch (\Throwable $th) {
            return response()->json([
                'message' => 'Request Validation failed.',
                'errors' => $th->getMessage(),
            ], 422);
        }
        $newProviderPlatform = new ProviderPlatform($providerPlatform);
        $newProviderPlatform->encryptAccessKey($request['access_key']);
        $newProviderPlatform->save();

        return ProviderPlatformResource::make($newProviderPlatform);
    }

    /**
     * Display the specified resource.
     */
    public function show(AdminRequest $request, string $id)
    {
        $show_key = $request->query('show_key', false);
        $request->authorize();
        $provider_platform = ProviderPlatform::findOrFail($id);
        if (!$show_key) {
            return ProviderPlatformResource::make($provider_platform);
        }
        $key = $provider_platform->access_key;
        try {
            $provider_platform->access_key = $provider_platform->decryptAccessKey();
        } catch (\Illuminate\Contracts\Encryption\DecryptException $e) {
            $provider_platform->access_key = $key;
        }

        return ProviderPlatformAccessKeyResource::make($provider_platform);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateProviderPlatformRequest $request, string $id)
    {
        try {
            $validated = $request->validated();
        } catch (\Throwable $th) {
            return response()->json([
                'message' => 'Request Validation failed.',
                'errors' => $th->getMessage(),
            ], 422);
        }
        $providerPlatform = ProviderPlatform::findOrFail($id);
        if (array_key_exists('access_key', $validated) && !is_null($validated['access_key'])) {
            $providerPlatform->encryptAccessKey($validated['access_key']);
            $providerPlatform->save();
        }
        $providerPlatform->update($validated);

        return ProviderPlatformResource::make($providerPlatform);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(AdminRequest $request, string $id)
    {
        $request->authorize();
        $providerPlatform = ProviderPlatform::findOrFail($id);
        $providerPlatform->delete();

        return response()->noContent();
    }
}
