<?php

namespace App\Http\Controllers\v1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreProviderPlatformRequest;
use App\Http\Requests\UpdateProviderPlatformRequest;
use App\Http\Resources\PaginateResource;
use App\Http\Resources\ProviderPlatformResource;
use App\Models\ProviderPlatform;

class ProviderPlatformController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $providerPlatforms = ProviderPlatform::paginate(10);

        return PaginateResource::make($providerPlatforms, ProviderPlatformResource::class);
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
        $newProviderPlatform = ProviderPlatform::create($providerPlatform);
        // $newProviderPlatform->hashAccessKey();

        return ProviderPlatformResource::make($newProviderPlatform);
    }

    /**
     * Display the specified resource.
     */
    public function show(ProviderPlatform $providerPlatform)
    {
        return ProviderPlatformResource::make($providerPlatform);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateProviderPlatformRequest $request, ProviderPlatform $providerPlatform)
    {
        try {
            $validated = $request->validated();
        } catch (\Throwable $th) {
            return response()->json([
                'message' => 'Request Validation failed.',
                'errors' => $th->getMessage(),
            ], 422);
        }
        $providerPlatform = ProviderPlatform::findOrFail($providerPlatform->id);
        $providerPlatform->update($validated);

        return ProviderPlatformResource::make($providerPlatform);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(ProviderPlatform $providerPlatform)
    {
        $providerPlatform = ProviderPlatform::findOrFail($providerPlatform->id);
        $providerPlatform->delete();

        return response()->noContent();
    }
}
