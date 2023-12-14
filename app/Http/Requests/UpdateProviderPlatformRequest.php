<?php

namespace App\Http\Requests;

use App\Enums\ProviderPlatformState;
use App\Enums\ProviderPlatformType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProviderPlatformRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        //TODO: FIX THIS
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
            'name' => 'nullable|string|max:255',
            'type' => 'nullable',
            'type' => [Rule::enum(ProviderPlatformType::class)],
            'description' => 'nullable|string|max:255',
            'icon_url' => 'nullable|url:http,https',
            'account_id' => 'nullable',
            'access_key' => 'nullable',
            'base_url' => 'nullable|url:http,https',
            'state' => [Rule::enum(ProviderPlatformState::class)],
        ];
    }
}
