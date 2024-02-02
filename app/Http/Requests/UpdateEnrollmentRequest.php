<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateEnrollmentRequest extends FormRequest
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
            'provider_id' => 'nullable|string',
            'enrollment_state' => 'nullable|in:active,inactive,completed,deleted',
            'links' => 'nullable|json',
            'provider_start_at' => 'nullable|date',
            'provider_end_at' => 'nullable|date|after_or_equal:provider_start_at',
            'provider_platform_id' => 'nullable|exists:provider_platforms,id',
            'provider_user_id' => 'nullable|max:255',
            'provider_course_id' => 'nullable|max:255',
        ];
    }
}
