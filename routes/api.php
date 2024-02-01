<?php

use App\Http\Controllers\v1\Actions\CreateCanvasUserLogin;
use App\Http\Controllers\v1\Actions\RegisterCanvasAuthProviderAction;
use App\Http\Controllers\v1\Actions\StoreUserCourseController;
use App\Http\Controllers\v1\Actions\StoreUserEnrollmentController;
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

Route::prefix('v1')->group(function () {
    Route::middleware(['web', 'auth'])->group(function () {

        Route::Resource('provider-platforms', ProviderPlatformController::class);

        Route::get('categories', [CategoryController::class, 'index']);
        Route::get('categories/{id}', [CategoryController::class, 'show']);
        Route::post('categories', [CategoryController::class, 'store']);
        Route::patch('categories/{id}', [CategoryController::class, 'update']);
        Route::delete('categories/{id}', [CategoryController::class, 'destroy']);

        Route::get('enrollments', [EnrollmentController::class, 'index']);
        Route::get('enrollments/{id}', [EnrollmentController::class, 'show']);
        Route::post('enrollments', [EnrollmentController::class, 'store']);
        Route::patch('enrollments/{id}', [EnrollmentController::class, 'update']);
        Route::delete('enrollments/{id}', [EnrollmentController::class, 'destroy']);

        Route::get('courses', [CourseController::class, 'index']);
        Route::get('courses/{id}', [CourseController::class, 'show']);
        Route::post('courses', [CourseController::class, 'store']);
        Route::patch('courses/{id}', [CourseController::class, 'update']);
        Route::delete('courses/{id}', [CourseController::class, 'destroy']);

        Route::get('users', [UserController::class, 'index']);
        Route::post('users', [UserController::class, 'store']);
        Route::get('users/logins', [ProviderUserMappingController::class, 'index']);
        Route::get('users/{id}', [UserController::class, 'show']);
        Route::patch('users/{id}', [UserController::class, 'update']);
        Route::delete('users/{id}', [UserController::class, 'destroy']);
        Route::get('users/{id}/logins', [ProviderUserMappingController::class, 'show']);
        Route::post('users/{id}/logins', [ProviderUserMappingController::class, 'store']);
        Route::delete('users/{id}/logins', [ProviderUserMappingController::class, 'destroy']);

        /* Actions/RPCs */
        Route::post('actions/register-canvas-auth', [RegisterCanvasAuthProviderAction::class, 'register']);
        Route::post('actions/create-canvas-login', [CreateCanvasUserLogin::class, 'create_canvas_login']);
        Route::post('provider-platforms/{providerId}/users/{userId}/courses', StoreUserCourseController::class);
        Route::post('provider-platforms/{providerId}/users/{userId}/enrollments', StoreUserEnrollmentController::class);
    });
});
