<?php

use App\Http\Controllers\v1\CategoryController;
use App\Http\Controllers\v1\CourseController;
use App\Http\Controllers\v1\EnrollmentController;
use App\Http\Controllers\v1\ProviderPlatformController;
use App\Http\Controllers\v1\StoreUserCourseController;
use App\Http\Controllers\v1\UserController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

Route::middleware('auth:passport')->get('/user', function (Request $request) {
    return $request->user();
});

Route::get('/v1/categories', [CategoryController::class, 'index']);
Route::get('/v1/categories/{id}', [CategoryController::class, 'show']);
Route::post('/v1/categories', [CategoryController::class, 'store']);
Route::patch('/v1/categories/{id}', [CategoryController::class, 'update']);
Route::delete('/v1/categories/{id}', [CategoryController::class, 'destroy']);

Route::get('/v1/enrollments', [EnrollmentController::class, 'index']);
Route::get('/v1/enrollments/{id}', [EnrollmentController::class, 'show']);
Route::post('/v1/enrollments', [EnrollmentController::class, 'store']);
Route::patch('/v1/enrollments/{id}', [EnrollmentController::class, 'update']);
Route::delete('/v1/enrollments/{id}', [EnrollmentController::class, 'destroy']);

Route::get('v1/courses', [CourseController::class, 'index']);
Route::get('/v1/courses/{id}', [CourseController::class, 'show']);
Route::post('/v1/courses', [CourseController::class, 'store']);
Route::patch('/v1/courses/{id}', [CourseController::class, 'update']);
Route::delete('/v1/courses/{id}', [CourseController::class, 'destroy']);

Route::get('/v1/users', [UserController::class, 'index']);
Route::get('/v1/users/{id}', [UserController::class, 'show']);
Route::post('/v1/users', [UserController::class, 'store']);
Route::patch('/v1/users/{id}', [UserController::class, 'update']);
Route::delete('/v1/users/{id}', [UserController::class, 'destroy']);

Route::prefix('v1')->group(function () {
    Route::Resource('provider-platforms', ProviderPlatformController::class);
    Route::post('provider-platforms/{providerId}/users/{userId}', StoreUserCourseController::class);
});
