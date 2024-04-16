<?php

declare(strict_types=1);

namespace App\Http\Controllers\v1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UserAuthRequest;
use App\Http\Resources\UserCourseActivityResource;
use App\Models\UserCourseActivity;

class UserCourseActivityController extends Controller
{
    /*
     * GET /api/v1/users/{id}/course-activity
     * Get user course activity
     * @param $request
     * @param $user_id
     * @return \Illuminate\Http\Resources\Json\AnonymousResourceCollection
     */
    public function index(UserAuthRequest $request, int $user_id): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
    {
        $request->authorize();
        $perPage = request()->query('per_page', 10);
        $sortBy = request()->query('sort', 'date');
        $sortOrder = request()->query('order', 'asc');
        $search = request()->query('search', '');
        $query = UserCourseActivity::where('user_id', $user_id)
            ->with(['enrollment.course']);
        if ($search) {
            $query->whereHas('enrollment.course', function ($query) use ($search) {
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
     * @param $request
     * @param $user_id
     * @param $courseId
     */
    public function show(int $user_id, int $course_id, UserAuthRequest $request): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
    {
        $request->authorize();
        $perPage = request()->query('per_page', 10);
        $sortBy = request()->query('sort', 'date');
        $sortOrder = request()->query('order', 'asc');

        $query = UserCourseActivity::where('user_id', $user_id)
            ->whereHas('enrollment.course', function ($query) use ($course_id) {
                $query->where('course_id', $course_id);
            })
            ->with(['enrollment.course']);

        $query->orderBy($sortBy, $sortOrder);
        $users = $query->paginate($perPage);

        return UserCourseActivityResource::collection($users);
    }
}
