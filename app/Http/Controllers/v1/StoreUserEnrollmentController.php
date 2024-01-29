<?php

namespace App\Http\Controllers\v1;

use App\Http\Controllers\Controller;
use App\Http\Resources\EnrollmentResource;
use App\Http\Resources\PaginateResource;
use App\Models\Course;
use App\Models\Enrollment;
use App\Services\CanvasServices;
use Illuminate\Http\Request;

class StoreUserEnrollmentController extends Controller
{
    /**
     * Handle the incoming request.
     */
    public function __invoke(Request $request, int $providerId, string $userId)
    {

        $this->canvasService = CanvasServices::byProviderId($providerId);
        $canvasEnrollments = $this->canvasService->getEnrollmentsByUser($userId);
        $enrollmentCollection = collect();
        foreach ($canvasEnrollments as $enrollment) {
            if ($course = Course::where('provider_resource_id', $enrollment->course_id)->firstOrFail()) {
                $request->merge([
                    'user_id' => 1,
                    'course_id' => $course->id,
                    'provider_user_id' => $enrollment->user_id,
                    'provider_course_id' => $enrollment->course_id,
                    'provider_id' => $providerId,
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
                    'provider_id' => 'required|exists:provider_platforms,id',
                    'enrollment_state' => 'required',
                    'links' => 'nullable',
                ]);

                $enrollmentCollection->push(Enrollment::create($validated));
            }
        }

        $enrollmentCollection = Enrollment::paginate(10);

        return PaginateResource::make($enrollmentCollection, EnrollmentResource::class);
    }
}
