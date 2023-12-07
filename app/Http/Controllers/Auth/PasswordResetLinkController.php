<?php

namespace App\Http\Controllers\Auth;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PasswordResetLinkController extends Controller
{
    /**
     * Display the password reset link request view.
     */
    public function create(): Response
    {
        return Inertia::render('Auth/ForgotPassword', [
            'status' => session('status'),
        ]);
    }

    /**
     * Handle an incoming password reset request
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): JsonResponse | RedirectResponse
    {
        $request->validate(['username' => 'required|string|max:50']);

        // *** Only student passwords can be reset this way.***
        // We are going to set a temporary passwrod for the user, and
        // set `reset_password` to `true` so that on next login they can be
        // prompted to set their new password.
        $user = User::where('username', $request->username)->first();
        if ($user['role'] === UserRole::Student) {
            $user->createTempPassword();
            return response()->json([
                'message' => 'Temporary password set, student must set new password upon next login',
                'data' => [
                    'username' => $user['username'],
                    'password' => $user['password'],
                ]
            ]);
        } else {
            return redirect()->back()->with(
                'status',
                'Only student passwords can be reset this way.'
            );
        }
    }
}
