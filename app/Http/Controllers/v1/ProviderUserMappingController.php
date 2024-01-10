<?php

namespace App\Http\Controllers\v1;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreateProviderUserMappingRequest;
use App\Http\Requests\ProviderUserMappingRequest;
use App\Http\Resources\ProviderUserMappingResource;
use App\Models\ProviderUserMapping;
use App\Models\User;
use Illuminate\Http\Request;

class CanvasLoginController extends Controller
{
    /**
     * Display a listing of all external provider logins.
     */
    public function index()
    {
        $perPage = request()->query('per_page', 10);
        $sortBy = request()->query('sort', 'name_last');
        $sortOrder = request()->query('order', 'asc');
        $search = request()->query('search', '');
        $query = ProviderUserMapping::query()->getRelation('users')->getQuery();
        if ($search) {
            $user = User::where('name_last', 'like', '%'.$search.'%')
                ->orWhere('name_first', 'like', '%'.$search.'%')
                ->orWhere('email', 'like', '%'.$search.'%')
                ->orWhere('username', 'like', '%'.$search.'%')
                ->firstOrFail();
            if ($user) {
                $query->where('user_id', $user->id);
            }
        }

        $query->orderBy($sortBy, $sortOrder);

        $logins = $query->paginate($perPage);

        return ProviderUserMappingResource::collection($logins);
    }

    /**
     * Create a new login to a given provider for a given User.
     */
    public function create(CreateProviderUserMappingRequest $request)
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
     * Optionally filter by provider_id.
     * GET: /api/v1/users/{user_id}/logins
     */
    public function show(int $userId)
    {
        $providerId = request()->query('provider_id', null);
        if ($providerId) {
            // returns an array but will only ever have one element
            $user = ProviderUserMapping::with([['user_id', $userId], ['provider_platform_id', $providerId]])->all();
        } else {
            $user = ProviderUserMapping::with('user_id', $userId)->all();
        }
        if (! $user) {
            return response()->json(['error' => 'User not found'], 404);
        }

        return ProviderUserMappingResource::collection($user);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(ProviderUserMappingRequest $request)
    {
        $validated = $request->validated();
        $user = ProviderUserMapping::with([['user_id', $validated['user_id']], ['provider_platform_id', $validated['provider_platform_id']]]);
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
    public function destroy(ProviderUserMappingRequest $request)
    {
        // This request valitates the userid and providerid only, so we are sure of which user mapping to delete
        $validated = $request->validated();
        $user = ProviderUserMapping::where('user_id', $validated['user_id']);
        if (! $user) {
            return response()->json(['error' => 'User not found'], 404);
        } else {
            $user->delete();
        }
    }
}
