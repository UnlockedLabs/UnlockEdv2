<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class PasswordController extends Controller
{
    /**
     * Update the user's password.
     */
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'password' => ['required', Password::defaults()],
            'password_confirmation' => ['required', 'same:password'],
        ]);

        $request->user()->update([
            'password' => Hash::make($validated['password']),
            'password_reset' => false,
        ]);

        return redirect()->route('dashboard');
    }
}
