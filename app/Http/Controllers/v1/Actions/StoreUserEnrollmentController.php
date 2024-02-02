<?php

namespace App\Http\Controllers\v1\Actions;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminRequest;
use App\Http\Resources\EnrollmentResource;
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
        $canvasEnrollments = $canvasService->getEnrollmentsByUser($userId);
        $enrollmentCollection = collect();
        foreach ($canvasEnrollments as $enrollment) {
            if ($course = Course::where('provider_resource_id', $enrollment->course_id)->firstOrFail()) {
                $request->merge([
                    'user_id' => $userId,
                    'course_id' => $course->id,
                    'provider_user_id' => $enrollment->user_id,
                    'provider_course_id' => $enrollment->course_id,
                    'provider_platform_id' => $providerId,
                    'provider_enrollment_id' => $enrollment->id,
                    // 'provider_course_name' => $enrollment->sis_course_id,
                    'enrollment_state' => $enrollment->enrollment_state,
                    'links' => [],
                    'provider_start_at' => $enrollment->start_at,
                    'provider_end_at' => $enrollment->end_at,
                ]);
                $validated = $request->validate([
                    'user_id' => 'required|exists:users,id',
                    'course_id' => 'required|exists:courses,id',
                    'provider_user_id' => 'required',
                    'provider_course_id' => 'required',
                    'provider_platform_id' => 'required|exists:provider_platforms,id',
                    'provider_enrollment_id' => 'required|unique:enrollments,provider_enrollment_id',
                    'enrollment_state' => 'required',
                    'links' => 'nullable',
                ]);

                $enrollmentCollection->push(Enrollment::create($validated));
            }
        }

        return EnrollmentResource::collection($enrollmentCollection);
    }
}
