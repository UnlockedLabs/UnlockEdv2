<?php

namespace App\Http\Controllers\v1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminRequest;
use App\Http\Requests\StoreEnrollmentRequest;
use App\Http\Requests\UpdateEnrollmentRequest;
use App\Http\Resources\EnrollmentResource;
use App\Models\Enrollment;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class EnrollmentController extends Controller
{
    public function index(Request $request)
    {
        $perPage = request()->query('per_page', 10);
        $sortBy = request()->query('sort', 'user_id');
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
        if ($request->user()->isAdmin()) {
            $query->orderBy($sortBy, $sortOrder);
            $categories = $query->paginate($perPage);

            return EnrollmentResource::collection($categories);
        } else {

            $query->where(['user_id' => $request->user()->id]);
            $query->orderBy($sortBy, $sortOrder);
            $categories = $query->paginate($perPage);

            return EnrollmentResource::collection($categories);
        }
    }

    public function show(Request $request, string $id)
    {
        if ($request->user()->isAdmin()) {
            $enrollment = Enrollment::findOrFail($id);
            if (! $enrollment) {
                return response()->json(['error' => "Enrollment with this ID not found for User: {$request->user()->username}"], Response::HTTP_NOT_FOUND);
            }

            return new EnrollmentResource($enrollment);
        } else {
            $enrollment = Enrollment::findOrFail($id);
            if (! $enrollment || $enrollment->user_id != $request->user()->id) {
                return response()->json(['error' => "Enrollment with this ID not found for User: {$request->user()->username}"], Response::HTTP_NOT_FOUND);
            }
        }

        return new EnrollmentResource($enrollment);
    }

    public function store(StoreEnrollmentRequest $request)
    {
        $validated = $request->validated();

        $enrollment = Enrollment::create($validated);

        return EnrollmentResource::make($enrollment);
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

    public function destroy(AdminRequest $req, string $id)
    {
        $req->authorize();
        $Enrollment = Enrollment::find($id);

        if (! $Enrollment) {
            return response()->json(['error' => 'Enrollment not found'], Response::HTTP_NOT_FOUND);
        }

        $Enrollment->delete();

        return response(null, Response::HTTP_NO_CONTENT);
    }
}
