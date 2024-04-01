<?php

declare(strict_types=1);

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
            'enrollment_state' => 'nullable|in:active,inactive,completed,deleted',
            'external_link_url' => 'nullable|url',
            'external_start_at' => 'nullable|date',
            'external_end_at' => 'nullable|date|after_or_equal:provider_start_at',
            'external_enrollment_id' => 'nullable|max:255',
        ];
    }
}
