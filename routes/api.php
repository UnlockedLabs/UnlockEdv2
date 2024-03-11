<?php

use App\Http\Controllers\v1\Actions\CreateCanvasUserLogin;
use App\Http\Controllers\v1\Actions\RegisterCanvasAuthProviderAction;
use App\Http\Controllers\v1\Actions\StoreCanvasCoursesController;
use App\Http\Controllers\v1\Actions\StoreUserCourseController;
use App\Http\Controllers\v1\Actions\StoreUserEnrollmentController;
use App\Http\Controllers\v1\CategoryController;
use App\Http\Controllers\v1\CourseController;
use App\Http\Controllers\v1\EnrollmentController;
use App\Http\Controllers\v1\ProviderPlatformController;
use App\Http\Controllers\v1\ProviderUserMappingController;
use App\Http\Controllers\v1\UserActivityController;
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

        Route::get('provider-platforms', [ProviderPlatformController::class, 'index']);
        Route::get('provider-platforms/{id}', [ProviderPlatformController::class, 'show']);
        Route::post('provider-platforms', [ProviderPlatformController::class, 'store']);
        Route::patch('provider-platforms/{id}', [ProviderPlatformController::class, 'update']);
        Route::delete('provider-platforms/{id}', [ProviderPlatformController::class, 'destroy']);

        Route::get('categories', [CategoryController::class, 'index']);
        Route::put('categories', [CategoryController::class, 'update']);

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

        Route::get('user-activities', [UserActivityController::class, 'index']);
        Route::get('user-activities/{id}', [UserActivityController::class, 'show']);
        Route::post('user-activities', [UserActivityController::class, 'store']);
        Route::patch('user-activities/{id}', [UserActivityController::class, 'update']);
        Route::delete('user-activities/{id}', [UserActivityController::class, 'destroy']);

        /* Actions/RPCs */
        Route::post('actions/register-canvas-auth', [RegisterCanvasAuthProviderAction::class, 'register']);
        Route::post('actions/create-canvas-login', [CreateCanvasUserLogin::class, 'create_canvas_login']);
        Route::post('actions/store-user-courses', StoreUserCourseController::class);
        Route::post('actions/store-canvas-courses', StoreCanvasCoursesController::class);
        Route::post('actions/store-user-enrollments', StoreUserEnrollmentController::class);
    });
});
