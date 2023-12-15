<?php

namespace App\Http\Controllers\v1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCategoryRequest;
use App\Http\Requests\UpdateCategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use Illuminate\Http\Response;

class CategoryController extends Controller
{
    public function index()
    {
        $perPage = request()->query('per_page', 10);
        $sortBy = request()->query('sort', 'rank');
        $sortOrder = request()->query('order', 'asc');
        $search = request()->query('search', '');

        $query = Category::query();

        // Apply search
        if ($search) {
            $query->where(function ($query) use ($search) {
                $query->where('name', 'like', '%'.$search.'%')
                    ->orWhere('links', 'like', '%'.$search.'%');
            });
        }

        $query->orderBy($sortBy, $sortOrder);

        $categories = $query->paginate($perPage);

        return CategoryResource::collection($categories);
    }

    public function show($id)
    {
        $category = Category::find($id);

        if (! $category) {
            return response()->json(['error' => 'Category not found'], Response::HTTP_NOT_FOUND);
        }

        return new CategoryResource($category);
    }

    public function store(StoreCategoryRequest $request)
    {
        $validated = $request->validated();

        $category = Category::create($validated->all());

        return CategoryResource::collection($category);
    }

    public function update(UpdateCategoryRequest $request, $id)
    {
        $validated = $request->validated();

        $category = Category::find($id);

        if (! $category) {
            return response()->json(['error' => 'Category not found'], Response::HTTP_NOT_FOUND);
        }

        $category->update($validated);

        return new CategoryResource($category);
    }

    public function destroy($id)
    {
        $category = Category::find($id);

        if (! $category) {
            return response()->json(['error' => 'Category not found'], Response::HTTP_NOT_FOUND);
        }

        $category->delete();

        return response(null, Response::HTTP_NO_CONTENT);
    }
}
