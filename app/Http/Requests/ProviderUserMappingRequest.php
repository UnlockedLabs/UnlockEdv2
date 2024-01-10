<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ProviderUserMappingRequest extends FormRequest
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
            'user_id' => 'required|integer',
            'provider_id' => 'required|integer',
            'external_id' => 'nullable|string|max:255',
            'external_username' => 'nullable|string|max:255',
            'authentication_provider_id' => 'nullable|string|max:255',
        ];
    }
}
