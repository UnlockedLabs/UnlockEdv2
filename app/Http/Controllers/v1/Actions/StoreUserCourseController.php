<?php

namespace App\Http\Controllers\v1\Actions;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminRequest;
use App\Http\Resources\CourseResource;
use App\Models\Course;
use App\Services\CanvasServices;

class StoreUserCourseController extends Controller
{
    /**
     * Handle the incoming request.
     *
     * This retrieves an array of course objects
     * that the user is enrolled in and persists
     * them in the UnlockEd v2 database.
     */
    public function __invoke(AdminRequest $request)
    {
        try {
            $canvasService = CanvasServices::byProviderId($request->provider_platform_id);
        } catch (\Exception) {
            return response()->json(['message' => 'Provider not found'], 404);
        }
        $canvasCourses = $canvasService->listCoursesForUser($request->user_id);
        $courseCollection = collect();
        foreach ($canvasCourses as $course) {
            $request->merge([
                'provider_resource_id' => $course->id, 'provider_course_name' => $course->name, 'provider_platform_id' => $request->provider_platform_id, 'description' => $course->public_description,
                'provider_start_at' => $course->start_at, 'provider_end_at' => $course->end_at, 'img_url' => $course->course_image,
            ]);
            $request->validate([
                'provider_platform_id' => 'required|exists:platforms,id',
                'provider_resource_id' => 'required|string|max:255|unique:courses,provider_resource_id',
                'provider_course_name' => 'required|string|max:255',
                'description' => 'required|string|max:255',
                'provider_start_at' => 'required|date',
                'provider_end_at' => 'required|date',
                'img_url' => 'nullable|string|max:255',
            ]);

            $courseCollection->push(Course::create($request->all()));
        }

        return CourseResource::collection($courseCollection);
    }
}
