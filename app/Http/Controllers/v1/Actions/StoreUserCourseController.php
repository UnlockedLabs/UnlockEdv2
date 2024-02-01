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
    public function __invoke(AdminRequest $request, int $providerId, string $userId)
    {
        try {
            $canvasService = CanvasServices::byProviderId($providerId);
        } catch (\Exception) {
            return response()->json(['message' => 'Provider not found'], 404);
        }
        $canvasCourses = $canvasService->listCoursesForUser($userId);
        $courseCollection = collect();
        foreach ($canvasCourses as $course) {
            $request->merge(['provider_resource_id' => (string) $course->id, 'provider_course_name' => $course->name]);
            $validated = $request->validate([
                'provider_resource_id' => 'required|string|max:255|unique:courses',
                'provider_course_name' => 'required|string|max:255',
            ]);

            $courseCollection->push(Course::create($validated));
        }

        return CourseResource::collection($courseCollection);
    }
}
