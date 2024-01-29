<?php

namespace App\Http\Controllers\v1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreEnrollmentRequest;
use App\Http\Requests\UpdateEnrollmentRequest;
use App\Http\Resources\EnrollmentResource;
use App\Models\Enrollment;
use Illuminate\Http\Response;

class EnrollmentController extends Controller
{
    public function index()
    {
        $perPage = request()->query('per_page', 10);
        $sortBy = request()->query('sort', 'rank');
        $sortOrder = request()->query('order', 'asc');
        $search = request()->query('search', '');

        $query = Enrollment::query();

        // Apply search
        if ($search) {
            $query->where(function ($query) use ($search) {
                $query->where('name', 'like', '%'.$search.'%')
                    ->orWhere('links', 'like', '%'.$search.'%');
            });
        }

        $query->orderBy($sortBy, $sortOrder);

        $categories = $query->paginate($perPage);

        return EnrollmentResource::collection($categories);
    }

    public function show($id)
    {
        $Enrollment = Enrollment::find($id);

        if (! $Enrollment) {
            return response()->json(['error' => 'Enrollment not found'], Response::HTTP_NOT_FOUND);
        }

        return new EnrollmentResource($Enrollment);
    }

    public function store(StoreEnrollmentRequest $request)
    {
        $validated = $request->validated();

        $Enrollment = Enrollment::create($validated);

        return EnrollmentResource::collection($Enrollment);
    }

    public function update(UpdateEnrollmentRequest $request, $id)
    {
        $validated = $request->validated();

        $Enrollment = Enrollment::findOrFail($id);

        if (! $Enrollment) {
            return response()->json(['error' => 'Enrollment not found'], Response::HTTP_NOT_FOUND);
        }

        $Enrollment->update($validated);

        return new EnrollmentResource($Enrollment);
    }

    public function destroy($id)
    {
        $Enrollment = Enrollment::find($id);

        if (! $Enrollment) {
            return response()->json(['error' => 'Enrollment not found'], Response::HTTP_NOT_FOUND);
        }

        $Enrollment->delete();

        return response(null, Response::HTTP_NO_CONTENT);
    }
}
