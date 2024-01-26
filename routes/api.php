<?php

use App\Http\Controllers\v1\Actions\RegisterCanvasAuthProviderAction;
use App\Http\Controllers\v1\CategoryController;
use App\Http\Controllers\v1\CourseController;
use App\Http\Controllers\v1\EnrollmentController;
use App\Http\Controllers\v1\ProviderPlatformController;
use App\Http\Controllers\v1\ProviderUserMappingController;
use App\Http\Controllers\v1\UserController;
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

Route::get('/v1/categories', [CategoryController::class, 'index'])->middleware('auth:api');
Route::get('/v1/categories/{id}', [CategoryController::class, 'show'])->middleware('auth:api');
Route::post('/v1/categories', [CategoryController::class, 'store'])->middleware('auth:api');
Route::patch('/v1/categories/{id}', [CategoryController::class, 'update'])->middleware('auth:api');
Route::delete('/v1/categories/{id}', [CategoryController::class, 'destroy'])->middleware('auth:api');

Route::get('/v1/enrollments', [EnrollmentController::class, 'index'])->middleware('auth:api');
Route::get('/v1/enrollments/{id}', [EnrollmentController::class, 'show'])->middleware('auth:api');
Route::post('/v1/enrollments', [EnrollmentController::class, 'store'])->middleware('auth:api');
Route::patch('/v1/enrollments/{id}', [EnrollmentController::class, 'update'])->middleware('auth:api');
Route::delete('/v1/enrollments/{id}', [EnrollmentController::class, 'destroy'])->middleware('auth:api');

Route::get('v1/courses', [CourseController::class, 'index'])->middleware('auth:api');
Route::get('/v1/courses/{id}', [CourseController::class, 'show'])->middleware('auth:api');
Route::post('/v1/courses', [CourseController::class, 'store'])->middleware('auth:api');
Route::patch('/v1/courses/{id}', [CourseController::class, 'update'])->middleware('auth:api');
Route::delete('/v1/courses/{id}', [CourseController::class, 'destroy'])->middleware('auth:api');

Route::get('/v1/users', [UserController::class, 'index'])->middleware('auth:api');
Route::post('/v1/users', [UserController::class, 'store'])->middleware('auth:api');
Route::get('/v1/users/logins', [ProviderUserMappingController::class, 'index'])->middleware('auth:api');
Route::get('/v1/users/{id}', [UserController::class, 'show'])->middleware('auth:api');
Route::patch('/v1/users/{id}', [UserController::class, 'update'])->middleware('auth:api');
Route::delete('/v1/users/{id}', [UserController::class, 'destroy'])->middleware('auth:api');
Route::get('/v1/users/{id}/logins', [ProviderUserMappingController::class, 'show'])->middleware('auth:api');
Route::post('/v1/users/{id}/logins', [ProviderUserMappingController::class, 'store'])->middleware('auth:api');
Route::delete('/v1/users/{id}/logins', [ProviderUserMappingController::class, 'destroy'])->middleware('auth:api');

Route::prefix('v1')->group(function () {
    Route::Resource('provider-platforms', ProviderPlatformController::class);
})->middleware('auth:api');

/* Actions/RPCs */
Route::post('/v1/actions/register-canvas-auth', [RegisterCanvasAuthProviderAction::class, 'register']);
