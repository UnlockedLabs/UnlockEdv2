<?php

declare(strict_types=1);

namespace App\Http\Controllers\v1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUserActivityRequest;
use App\Http\Requests\UserAuthRequest;
use App\Http\Resources\UserActivityResource;
use App\Models\User;
use App\Models\UserActivity;
use Illuminate\Http\Request;

class UserActivityController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->query('per_page', 10);
        $sortBy = $request->query('sort', 'user_activities.created_at'); // Change 'rank' to 'created_at' for timestamps
        $sortOrder = $request->query('order', 'asc');
        $search = $request->query('search', '');

        $query = UserActivity::query()->join('users', 'user_activities.user_id', '=', 'users.id')
            ->select('user_activities.*', 'users.name_first', 'users.name_last');
        $query->orderBy('user_activities.created_at', $sortOrder);
        // Apply search
        if ($search !== null) {
            $query->where(function ($query) use ($search) {
                $query->where('users.name_first', 'like', '%'.$search.'%')
                    ->orWhere('users.name_last', 'like', '%'.$search.'%')
                    ->orWhere('clicked_url', 'like', '%'.$search.'%');
            });
        }
        // Check if the user is an admin
        if ($request->user()->isAdmin()) {
            $query->orderBy($sortBy, $sortOrder);
        } else {
            $query->where('user_id', $request->user()->id);
        }

        $userActivities = $query->paginate($perPage);

        return UserActivityResource::collection($userActivities);
    }

    public function show(UserAuthRequest $request, string $id)
    {
        $request->authorize();
        $userActivity = User::findOrFail($id)->userActivity()->get();

        return UserActivityResource::collection($userActivity);
    }

    public function store(StoreUserActivityRequest $request)
    {
        $validated = $request->validated();
        $userActivity = UserActivity::create($validated);

        return UserActivityResource::make($userActivity);
    }
}
