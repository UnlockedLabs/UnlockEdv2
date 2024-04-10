<?php

declare(strict_types=1);

namespace App\Http\Controllers\v1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use Illuminate\Http\Response;

class CategoryController extends Controller
{
    public function index()
    {
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

        $categories = $query->get();

        return CategoryResource::collection($categories);
    }

    public function update(AdminRequest $request)
    {
        $valid = $request->validate([
            '*.name' => 'required|string',
            '*.rank' => 'required|integer',
            '*.links' => 'required|array',
        ]);

        // delete the current state of the left-menu categories
        Category::truncate();
        // store the updated state
        foreach ($valid as $category) {
            Category::create($category);
        }

        return response()->json(['message' => 'Category state reset successfully'], Response::HTTP_OK);
    }
}
