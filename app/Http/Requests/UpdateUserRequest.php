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
        // TODO: GET AUTH SETUP
        return true;
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
            'username' => 'nullable|max:50|unique:users',
            'email' => 'nullable|email|max:75|unique:users',
        ];
    }
}
