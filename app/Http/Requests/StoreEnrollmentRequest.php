<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreEnrollmentRequest extends FormRequest
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
            'user_id' => 'required|exists:users,id',
            'course_id' => 'required|exists:courses,id',
            'enrollment_state' => 'nullable|in:active,inactive,completed,deleted',
            'provider_user_id' => 'required|max:255',
            'provider_enrollment_id' => 'required|max:255',
            'provider_start_at' => 'required|date',
            'provider_end_at' => 'nullable|date|after_or_equal:provider_start_at',
            'link_url' => 'nullable|url|max:255',
        ];
    }
}
