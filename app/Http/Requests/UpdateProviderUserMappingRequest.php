<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProviderUserMappingRequest extends FormRequest
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
            'user_id' => 'integer|max:255',
            'provider_platform_id' => 'integer|max:255',
            'external_id' => 'string|max:255',
            'external_username' => 'string|max:255',
            'authentication_provider_id' => 'string|max:255',
        ];
    }
}
