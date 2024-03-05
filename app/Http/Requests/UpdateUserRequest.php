<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateUserRequest extends FormRequest
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
            'name_first' => 'nullable|string|max:25',
            'name_last' => 'nullable|string|max:25',
            'email' => 'nullable|email|max:75|unique:users',
            'username' => 'nullable|max:50|unique:users',
            'role' => 'nullable|string|in:student,admin',
        ];
    }
}
