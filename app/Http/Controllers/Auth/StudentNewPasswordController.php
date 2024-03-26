<?php

namespace App\Http\Controllers\Auth;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\AdminRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;

class StudentNewPasswordController extends Controller
{
    public function store(AdminRequest $request): JsonResponse|RedirectResponse
    {
        $user = User::findOrFail($request['user_id']);
        if ($user->role != UserRole::STUDENT) {
            return response()->json([
                'message' => 'Only non-admin accounts can have their passwords reset',
            ], 403);
        }
        $pw = $user->createTempPassword();

        return response()->json([
            'message' => 'Temporary password set, Student must set new password upon next login',
            'data' => [
                'password' => $pw,
            ],
        ], 201);
    }
}
