<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCourseRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        // Todo add authorization
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
            'provider_resource_id' => 'required|string|max:255',
            'provider_course_name' => 'required|string|max:255',
            'user_id' => 'required|integer',
            'provider_platform_id' => 'required|integer',
            'external_id' => 'nullable|string|max:255',
            'external_username' => 'nullable|string|max:255',
            'authentication_provider_id' => 'nullable|string|max:255',
        ];
    }
}
