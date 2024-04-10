<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'password_reset'])->name('dashboard');

Route::get('/users', function () {
    return Inertia::render('Users');
})->middleware(['auth', 'password_reset'])->name('users');

Route::get('/left-menu-management', function () {
    return Inertia::render('LeftMenuManagement');
})->middleware(['auth', 'password_reset', 'check_user_role'])->name('left-menu-management');

Route::get('/provider-platform-management', function () {
    return Inertia::render('ProviderPlatformManagement');
})->middleware(['auth', 'password_reset'])->name('provider-platform-management');

Route::get('/user-activity', function () {
    return Inertia::render('UserActivity');
})->middleware(['auth', 'password_reset'])->name('user-activity');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';
