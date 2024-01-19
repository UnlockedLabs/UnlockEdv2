<?php

namespace App\Http\Controllers\v1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCoursesRequest;
use App\Http\Requests\UpdateCoursesRequest;
use App\Http\Resources\CoursesResource;
use App\Models\Courses;
use Illuminate\Http\Response;

class CoursesController extends Controller
{
    
    public function index()
    {
        $perPage = request()->query('per_page', 10);
        $sortBy = request()->query('sort','provider_course_name',);
        $sortOrder = request()->query('order', 'asc');

        $query = Courses::query();
        $query->orderBy($sortBy, $sortOrder);
        $courses = $query->paginate($perPage);

        return CoursesResource::collection($courses);
        
    }


    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreCoursesRequest $request) 
    {
        $validated = $request->validated();

        $course = Courses::create($validated->all());

        return CoursesResource::collection($course);
    }

   
    public function show(string $id)
    {
        $course = Courses::find($id);

        if(!$course){
            return response()->json(['error' => 'Course not found'], Response::HTTP_NOT_FOUND);

        }
        return new CoursesResource($course);
    }

   
   
    public function update(UpdateCoursesRequest $request, string $id)
    {
        $validated = $request->validated();
        $course = Courses::find($id);

        if(!$course){
            return response()->json(['error' => 'Course not found'], Response::HTTP_NOT_FOUND);

        }

        $course->update($validated);

        return new CoursesResource($course);
        
    }

   
    public function destroy(string $id)
    {
        $course = Courses::find($id);

        if(!$course){
            return response()->json(['error' => 'Course not found'], Response::HTTP_NOT_FOUND);
        }

        $course->delete(); 
        return response(null,Response::HTTP_NO_CONTENT);
    }
}
