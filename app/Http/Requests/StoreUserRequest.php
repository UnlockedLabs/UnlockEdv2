<?php

namespace App\Http\Requests;

use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUserRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()->isAdmin();
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name_first' => 'required|string|max:35',
            'name_last' => 'required|string|max:35',
            'email' => 'nullable|email|max:90|unique:users',
            'username' => 'required|string|max:70|unique:users',
            'role' => [Rule::Enum(UserRole::class)],
        ];
    }
}
