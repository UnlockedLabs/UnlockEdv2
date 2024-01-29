<?php

namespace App\Http\Controllers\v1;

use App\Http\Controllers\Controller;
use App\Http\Resources\CourseResource;
use App\Http\Resources\PaginateResource;
use App\Models\Course;
use App\Services\CanvasServices;
use Illuminate\Http\Request;

class StoreUserCourseController extends Controller
{
    private $canvasService;

    /**
     * Handle the incoming request.
     *
     * This retrieves an array of course objects
     * that the user is enrolled in and persists
     * them in the UnlockEd v2 database.
     */
    public function __invoke(Request $request, int $providerId, string $userId)
    {
        $this->canvasService = CanvasServices::byProviderId($providerId);
        $canvasCourses = $this->canvasService->listCoursesForUser($userId);
        $courseCollection = collect();
        foreach ($canvasCourses as $course) {
            $request->merge(['provider_resource_id' => (string) $course->id, 'provider_course_name' => $course->name]);
            $validated = $request->validate([
                'provider_resource_id' => 'required|string|max:255|unique:courses',
                'provider_course_name' => 'required|string|max:255',
            ]);

            $courseCollection->push(Course::create($validated));
        }

        $courseCollection = Course::paginate(10);

        return PaginateResource::make($courseCollection, CourseResource::class);
    }
}
