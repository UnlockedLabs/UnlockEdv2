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
            $canvasService = CanvasServices::byProviderId($request['provider_platform_id']);
        } catch (\Exception) {
            return response()->json(['message' => 'Provider not found'], 404);
        }
        $canvasCourses = $canvasService->listCoursesForUser($request['user_id']);
        $courseCollection = collect();
        foreach ($canvasCourses as $course) {
            if (isset($course['public_description'])) {
                $request->merge(['public_description' => $course['public_description'] ?? '']);
            }
            if (isset($course['course_image'])) {
                $request->merge(['img_url' => $course['course_image'] ?? '']);
            }
            $request->merge([
                'external_resource_id' => $course['id'], 'external_course_name' => $course['name'], 'provider_platform_id' => $request['provider_platform_id'],
                'external_course_code' => $course['course_code'],
            ]);
            $valid = $request->validate([
                'provider_platform_id' => 'required|exists:provider_platforms,id',
                'external_resource_id' => 'required|unique:courses,external_resource_id',
                'external_course_name' => 'required|string|max:255',
                'description' => 'nullable|string|max:255',
                'img_url' => 'nullable|string|max:255',
                'external_course_code' => 'required|string|max:255',
            ]);

            $courseCollection->push(Course::create($valid));
        }

        return CourseResource::collection($courseCollection);
    }
}
