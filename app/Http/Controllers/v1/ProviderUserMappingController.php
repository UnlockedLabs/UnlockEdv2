<?php

namespace App\Http\Controllers\v1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminRequest;
use App\Http\Requests\ProviderUserMappingRequest;
use App\Http\Requests\CreateProviderUserMappingRequest;
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
        if (request()->user()->isAdmin()) {
            $prov = ProviderUserMapping::all(['*']);
        } else {
            $prov = ProviderUserMapping::where('user_id', request()->user()->id)->get();
        }
        return ProviderUserMappingResource::collection($prov);
    }

    /**
     * Create a new login to a given provider for a given User.
     * POST /api/v1/users/{user_id}/logins
     */
    public function store(CreateProviderUserMappingRequest $request)
    {
        try {
            $validated = $request->validated();
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
    public function show(ProviderUserMappingRequest $req, string $userId)
    {
        if (!$req->overrideAuthorize($userId)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }
        try {
            $user = ProviderUserMapping::where('user_id', $userId)->get();
            return ProviderUserMappingResource::collection($user);
        } catch (\Throwable $th) {
            return response()->json(['error' => 'User not found'], 404);
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(AdminRequest $req, string $id)
    {
        $req->authorize();
        // This request valitates the userid and providerid only, so we are sure of which user mapping to delete
        $user = ProviderUserMapping::where('user_id', $id);
        if (!$user) {
            return response()->json(['error' => 'User not found'], 404);
        } else {
            $user->delete();
        }
    }
}
