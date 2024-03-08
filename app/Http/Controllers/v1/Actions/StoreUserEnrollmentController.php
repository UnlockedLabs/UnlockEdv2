<?php

namespace App\Http\Controllers\v1\Actions;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminRequest;
use App\Http\Resources\EnrollmentCourseJoinResource;
use App\Models\Course;
use App\Models\Enrollment;
use App\Services\CanvasServices;

class StoreUserEnrollmentController extends Controller
{
    /**
     * Handle the incoming request.
     */
    public function __invoke(AdminRequest $request)
    {
        $canvasService = CanvasServices::byProviderId($request->provider_platform_id);
        $canvasEnrollments = $canvasService->listEnrollmentsForUser($request->user_id);
        $enrollmentCollection = collect();
        foreach ($canvasEnrollments as $enrollment) {
            if ($course = Course::where('external_resource_id', $enrollment->course_id)->firstOrFail()) {
                $request->merge([
                    'user_id' => $request->user_id,
                    'course_id' => $course->id,
                    'external_enrollment_id' => $enrollment->id,
                    'enrollment_state' => $enrollment->enrollment_state,
                    'external_start_at' => $enrollment->start_at,
                    'external_end_at' => $enrollment->end_at,
                    'link_url' => $enrollment->html_url,
                ]);
                $validated = $request->validate([
                    'user_id' => 'integer|required|exists:users,id',
                    'course_id' => 'integer|required|exists:courses,id',
                    'external_enrollment_id' => 'integer|required|unique:enrollments,external_enrollment_id',
                    'enrollment_state' => 'required',
                    'external_start_at' => 'nullable|date',
                    'external_end_at' => 'nullable|date|after_or_equal:external_start_at',
                    'link_url' => 'required|url',
                ]);
                $enrollmentCollection->push(Enrollment::create($validated));
            }
        }

        return EnrollmentCourseJoinResource::collection($enrollmentCollection);
    }
}
