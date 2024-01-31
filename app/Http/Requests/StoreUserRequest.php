<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

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
            'name_first' => 'required|string|max:25',
            'name_last' => 'required|string|max:25',
            'email' => 'nullable|email|max:75|unique:users',
            'username' => 'required|string|max:60|unique:users',
            'role' => 'required|string|in:Student,Admin',
        ];
    }
}
