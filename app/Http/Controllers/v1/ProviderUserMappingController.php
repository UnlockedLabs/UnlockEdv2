<?php

namespace App\Http\Controllers\v1;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreateProviderUserMappingRequest;
use App\Http\Requests\UpdateProviderUserMappingRequest;
use App\Http\Resources\ProviderUserMappingResource;
use App\Models\ProviderUserMapping;

class ProviderUserMappingController extends Controller
{
    /**
     * Display a listing of all external provider logins.
     *
     * GET /api/v1/users/logins
     */
    public function index()
    {
        return ProviderUserMappingResource::collection(ProviderUserMapping::all());
    }

    /**
     * Create a new login to a given provider for a given User.
     * POST /api/v1/users/{user_id}/logins
     */
    public function store(CreateProviderUserMappingRequest $request)
    {
        $validated = $request->validated();
        try {
            $mapping = ProviderUserMapping::create($validated);

            return response()->json(['message' => 'Provider User Mapping created successfully', 'data' => $mapping], 201);
        } catch (\Throwable $th) {
            return response()->json(['error' => 'Provider not found'], 404);
        }
    }

    /**
     * List all external Provider logins for a specific User.
     *
     * GET: /api/v1/users/{user_id}/logins
     */
    public function show(string $userId)
    {
        $user = ProviderUserMapping::with('user_id', $userId)->get();

        return ProviderUserMappingResource::collection($user);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateProviderUserMappingRequest $request)
    {
        $validated = $request->validated();
        $user = ProviderUserMapping::with('user_id', $validated->user_id)->orWhere('provider_platform_id', $validated->provider_platform_id);
        if (! $user) {
            return response()->json(['error' => 'User not found'], 404);
        } else {
            $user->update($validated);

            return response()->json(['message' => 'User updated successfully'], 200);
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        // This request valitates the userid and providerid only, so we are sure of which user mapping to delete
        $user = ProviderUserMapping::where('user_id', $id);
        if (! $user) {
            return response()->json(['error' => 'User not found'], 404);
        } else {
            $user->delete();
        }
    }
}
