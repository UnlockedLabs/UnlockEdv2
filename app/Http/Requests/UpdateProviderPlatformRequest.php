<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProviderPlatformRequest extends FormRequest
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
            'name' => 'nullable|string|max:255',
            'type' => 'required|string',
            'description' => 'nullable|string|max:255',
            'icon_url' => 'nullable|url:http,https',
            'account_id' => 'nullable|int',
            'access_key' => 'nullable|string|max:255',
            'base_url' => 'nullable|url:http,https',
            'state' => 'required|string',
        ];
    }
}
