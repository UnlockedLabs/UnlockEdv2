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
        return $this->user()->isAdmin();
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        if (substr($this->input('img_url'), 0, 4) !== 'http' && $this->input('img_url') !== null) {
            $this->merge(['img_url' => 'http://'.$this->input('img_url')]);
        }

        return [
            'provider_platform_id' => 'required|exists:provider_platforms,id',
            'external_resource_id' => 'required|int|min:1',
            'external_course_name' => 'required|string|max:255',
            'external_course_code' => 'required|string|max:255',
            'description' => 'required|string|max:255',
            'img_url' => 'nullable|url|max:255',
        ];
    }
}
