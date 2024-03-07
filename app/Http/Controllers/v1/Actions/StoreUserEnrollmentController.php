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
    public function __invoke(AdminRequest $request, int $providerId, string $userId)
    {
        $canvasService = CanvasServices::byProviderId($providerId);
        $canvasEnrollments = $canvasService->listEnrollmentsForUser($userId);
        $enrollmentCollection = collect();
        foreach ($canvasEnrollments as $enrollment) {
            if ($course = Course::where('provider_resource_id', $enrollment->course_id)->firstOrFail()) {
                $request->merge([
                    'user_id' => $userId,
                    'course_id' => $course->id,
                    'provider_user_id' => $enrollment->user_id,
                    'provider_enrollment_id' => $enrollment->id,
                    'enrollment_state' => $enrollment->enrollment_state,
                    'provider_start_at' => $enrollment->start_at,
                    'provider_end_at' => $enrollment->end_at,
                    'link_url' => $enrollment->html_url,
                ]);
                $validated = $request->validate([
                    'user_id' => 'required|exists:users,id',
                    'course_id' => 'required|exists:courses,id',
                    'provider_user_id' => 'required',
                    'provider_enrollment_id' => 'required|unique:enrollments,provider_enrollment_id',
                    'enrollment_state' => 'required',
                    'link_url' => 'required|url',
                ]);
                $enrollmentCollection->push(Enrollment::create($validated));
            }
        }

        return EnrollmentCourseJoinResource::collection($enrollmentCollection);
    }
}
