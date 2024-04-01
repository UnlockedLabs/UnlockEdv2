<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class PasswordReset
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next)
    {
        // Check if the user is authenticated
        if (Auth::check()) {
            $user = Auth::user();
            // Check if the route is not the password reset route
            if ($request->route()->getName() !== 'password.reset' && $request->route()->getName() !== 'password.update' && $user->password_reset) {
                // Redirect to the password reset route
                return redirect()->route('password.reset');
            }
        }

        // Continue with the request
        return $next($request);
    }
}
