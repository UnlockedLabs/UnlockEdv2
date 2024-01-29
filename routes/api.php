<?php

use App\Http\Controllers\v1\Actions\RegisterCanvasAuthProviderAction;
use App\Http\Controllers\v1\CategoryController;
use App\Http\Controllers\v1\CourseController;
use App\Http\Controllers\v1\EnrollmentController;
use App\Http\Controllers\v1\ProviderPlatformController;
use App\Http\Controllers\v1\ProviderUserMappingController;
use App\Http\Controllers\v1\StoreUserCourseController;
use App\Http\Controllers\v1\StoreUserEnrollmentController;
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
Route::post('/v1/users', [UserController::class, 'store']);
Route::get('/v1/users/logins', [ProviderUserMappingController::class, 'index']);
Route::get('/v1/users/{id}', [UserController::class, 'show']);
Route::patch('/v1/users/{id}', [UserController::class, 'update']);
Route::delete('/v1/users/{id}', [UserController::class, 'destroy']);
Route::get('/v1/users/{id}/logins', [ProviderUserMappingController::class, 'show']);
Route::post('/v1/users/{id}/logins', [ProviderUserMappingController::class, 'store']);
Route::delete('/v1/users/{id}/logins', [ProviderUserMappingController::class, 'destroy']);

Route::prefix('v1')->group(function () {
    Route::Resource('provider-platforms', ProviderPlatformController::class);
    Route::post('provider-platforms/{providerId}/users/{userId}/courses', StoreUserCourseController::class);
    Route::post('provider-platforms/{providerId}/users/{userId}/enrollments', StoreUserEnrollmentController::class);
});

/* Actions/RPCs */
Route::post('/v1/actions/register-canvas-auth', [RegisterCanvasAuthProviderAction::class, 'register']);
