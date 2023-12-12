<?php

namespace App\Http\Controllers;

use App\Models\Category;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    /**
     * Display a listing of the Categories.
     */
    public function index()
    {
        $categories = Category::all();

        return response()->json($categories);
    }

    /**
     * Store a newly Category in storage.
     */
    public function store(Request $request)
    {
        $category = Category::create($request->all());

        return response()->json($category, 201);
    }

    /**
     * Display Category.
     */
    public function show(Category $category)
    {
        return response()->json($category);
    }

    /**
     * Update Category in storage.
     */
    public function update(Request $request, Category $category)
    {
        $category->update($request->all());

        return response()->json($category);
    }

    /**
     * Remove Category from storage.
     */
    public function destroy(Category $category)
    {
        $category->delete();

        return response()->json(null, 204);
    }
}