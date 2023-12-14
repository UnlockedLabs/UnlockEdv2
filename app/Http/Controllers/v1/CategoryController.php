<?php

namespace App\Http\Controllers\v1;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class CategoryController extends Controller
{
    public function index()
    {
        $categories = Category::all();

        return response()->json(CategoryResource::Collection($categories), Response::HTTP_OK);
    }

    public function show($id)
    {
        $category = Category::find($id);

        if (! $category) {
            return response()->json(['error' => 'Category not found'], Response::HTTP_NOT_FOUND);
        }

        return response()->json(new CategoryResource($category), Response::HTTP_OK);
    }

    public function store(Request $request)
    {
        $validator = validator($request->all(), [
            'name' => 'required|string|max:255',
            'rank' => 'required|integer',
            'links' => 'required|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $category = Category::create($request->all());

        return response()->json(CategoryResource::Collection($category), Response::HTTP_CREATED);
    }

    public function update(Request $request, $id)
    {
        $category = Category::find($id);

        if (! $category) {
            return response()->json(['error' => 'Category not found'], Response::HTTP_NOT_FOUND);
        }

        $request->validate([
            'name' => 'string|max:255',
            // Add other validation rules for your fields
        ]);

        $category->update($request->all());

        return response()->json(new CategoryResource($category), Response::HTTP_OK);
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
