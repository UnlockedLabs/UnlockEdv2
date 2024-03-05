<?php

namespace App\Http\Controllers\v1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminRequest;
use App\Http\Requests\ShowUserRequest;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Http\Resources\NewUserResource;
use App\Http\Resources\UserResource;
use App\Models\User;

class UserController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(AdminRequest $request)
    {
        $request = $request->validated();
        $perPage = request()->query('per_page', 10);
        $sortBy = request()->query('sort', 'name_last');
        $sortOrder = request()->query('order', 'asc');
        $search = request()->query('search', '');

        $query = User::query();

        // Apply search
        if ($search) {
            $query->where(function ($query) use ($search) {
                $query->where('name_last', 'like', '%'.$search.'%')
                    ->orWhere('name_first', 'like', '%'.$search.'%');
            });
        }

        $query->orderBy($sortBy, $sortOrder);

        $users = $query->paginate($perPage);

        return UserResource::collection($users);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreUserRequest $request)
    {
        try {
            $user = $request->validated();
        } catch (\Throwable $th) {
            return response()->json([
                'message' => 'Request Validation failed.',
                'errors' => $th->getMessage(),
            ], 422);
        }
        $newUser = new User($user);
        $pw = $newUser->createTempPassword();

        return response(NewUserResource::withPassword($newUser, $pw), 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(ShowUserRequest $request, string $id)
    {
        if (! $request->overrideAuthorize($id)) {
            return response()->json([
                'message' => "Non-Admin User with ID: {$request->user()->id} are not authorized to view this user.",
            ], 403);
        } else {
            $user = User::findOrFail($id);

            return new UserResource($user);
        }
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateUserRequest $request, string $id)
    {
        try {
            $validated = $request->validated();
        } catch (\Throwable $th) {
            return response()->json([
                'message' => 'Request Validation failed.',
                'errors' => $th->getMessage(),
            ], 422);
        }
        $user = User::findOrFail($id);
        $user->update($validated);
        $user->save();

        return new UserResource($user);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(AdminRequest $request, string $id)
    {
        $request->authorize();
        $user = User::findOrFail($id);
        $user->delete();

        return response()->json([
            'message' => 'User deleted successfully.',
        ], 204);
    }
}
