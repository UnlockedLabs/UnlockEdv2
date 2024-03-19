<?php

namespace App\Http\Controllers\v1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserCourseActivityResource;
use App\Models\UserCourseActivity;
use Illuminate\Http\Request;

class UserCourseActivityController extends Controller
{
    /*
     * GET /api/v1/users/{id}/course-activity
     * Get user course activity
     */
    public function index(Request $request, $id)
    {
        if ($request->user()->id != $id && ! $request->user()->isAdmin()) {
            return response()->json(['Message' => 'Unauthorized'], 403);
        }
        $perPage = request()->query('per_page', 10);
        $sortBy = request()->query('sort', 'date');
        $sortOrder = request()->query('order', 'asc');
        $search = request()->query('search', '');
        $query = UserCourseActivity::where('user_id', $id)->with('enrollment');
        if ($search) {
            $query->where(function ($query) use ($search) {
                $query->where('external_course_name', 'like', '%'.$search.'%');
            });
        }
        $query->orderBy($sortBy, $sortOrder);

        $users = $query->paginate($perPage);

        return UserCourseActivityResource::collection($users);
    }

    /*
     * GET /api/v1/users/{id}/course-activity/{courseId}
     * Get user course activity by course id
     */
    public function show($user_id, $course_id, Request $request)
    {
        if (! $request->user()->isAdmin() && $user_id != $request->user()->id) {
            return response()->json(['message' => 'Unauthorized to view this user'], 403);
        }
        $perPage = request()->query('per_page', 10);
        $sortBy = request()->query('sort', 'date');
        $sortOrder = request()->query('order', 'asc');

        $query = UserCourseActivity::where(['user_id' => $user_id])->whereHas('enrollment', function ($query) use ($course_id) {
            $query->where('course_id', $course_id);
        });

        $query->orderBy($sortBy, $sortOrder);

        $users = $query->paginate($perPage);

        return UserCourseActivityResource::collection($users);
    }
}
