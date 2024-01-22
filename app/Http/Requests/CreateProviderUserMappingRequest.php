<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CreateProviderUserMappingRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
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
            'user_id' => 'required|integer|exists:users,id',
            'provider_platform_id' => 'required|integer|exists:provider_platforms,id',
            'external_id' => 'required|string|max:255',
            'external_username' => 'required|string|max:255',
            'authentication_provider_id' => 'required|string|max:255',
        ];
    }
}
