<?php

namespace App\Http\Controllers\v1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminRequest;
use App\Http\Requests\StoreCourseRequest;
use App\Http\Requests\UpdateCourseRequest;
use App\Http\Resources\CourseResource;
use App\Models\Course;
use Illuminate\Http\Response;

class CourseController extends Controller
{
    public function index()
    {
        $perPage = request()->query('per_page', 10);
        $sortBy = request()->query('sort', 'external_course_name');
        $sortOrder = request()->query('order', 'asc');

        $query = Course::query();
        $query->orderBy($sortBy, $sortOrder);
        $courses = $query->paginate($perPage);

        return CourseResource::collection($courses);
    }

    public function show(string $id)
    {
        $course = Course::find($id);
        if (! $course) {
            return response()->json(['error' => 'Course not found'], Response::HTTP_NOT_FOUND);
        }

        return new CourseResource($course);
    }

    public function store(StoreCourseRequest $request)
    {
        $validated = $request->validated();

        $course = Course::create($validated->all());

        return CourseResource::collection($course);
    }

    public function update(UpdateCourseRequest $request, string $id)
    {
        $validated = $request->validated();
        $course = Course::find($id);

        if (! $course) {
            return response()->json(['error' => 'Course not found'], Response::HTTP_NOT_FOUND);
        }
        $course->update($validated);

        return new CourseResource($course);
    }

    public function destroy(AdminRequest $req, string $id)
    {
        $course = Course::find($id);
        if (! $course) {
            return response()->json(['error' => 'Course not found'], Response::HTTP_NOT_FOUND);
        }
        $course->delete();

        return response(null, Response::HTTP_NO_CONTENT);
    }
}
