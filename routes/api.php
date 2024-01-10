<?php

use App\Http\Controllers\v1\CategoryController;
use App\Http\Controllers\v1\ProviderPlatformController;
use App\Http\Controllers\v1\UserController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

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

Route::middleware('auth:api')->get('/user', function (Request $request) {
    $user = $request->user();
    $lookup = App\Models\User::findOrFail($user->id);

    return json_encode($lookup);
});

Route::get('/v1/categories', [CategoryController::class, 'index']);
Route::get('/v1/categories/{id}', [CategoryController::class, 'show']);
Route::post('/v1/categories', [CategoryController::class, 'store']);
Route::patch('/v1/categories/{id}', [CategoryController::class, 'update']);
Route::delete('/v1/categories/{id}', [CategoryController::class, 'destroy']);

Route::get('/v1/users', [UserController::class, 'index']);
Route::get('/v1/users/{id}', [UserController::class, 'show']);
Route::post('/v1/users', [UserController::class, 'store']);
Route::patch('/v1/users/{id}', [UserController::class, 'update']);
Route::delete('/v1/users/{id}', [UserController::class, 'destroy']);

Route::prefix('v1')->group(function () {
    Route::Resource('provider-platforms', ProviderPlatformController::class);
});

Route::get('/redirect', function (Request $request) {
    $request->session()->put('state', $state = Str::random(40));

    $query = http_build_query([
        'client_id' => 'client-id',
        'redirect_uri' => 'http://third-party-app.com/callback',
        'response_type' => 'code',
        'scope' => 'openid',
        'state' => $state,
        'prompt' => 'login', // "none", "consent", or "login"
    ]);

    return redirect('http://172.16.20.2/oauth/authorize?'.$query);
});
