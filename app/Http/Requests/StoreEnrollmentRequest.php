<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\EnrollmentState;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'enrollment_state' => [Rule::enum(EnrollmentState::class)],
            'external_enrollment_id' => 'required|max:255',
            'external_start_at' => 'required|date',
            'external_end_at' => 'nullable|date|after_or_equal:provider_start_at',
            'external_link_url' => 'nullable|url|max:255',
        ];
    }
}
