<?php

namespace App\Http\Requests;

use App\Enums\ProviderPlatformState;
use App\Enums\ProviderPlatformType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProviderPlatformRequest extends FormRequest
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
            'name' => 'required|string|max:255',
            'type' => [Rule::enum(ProviderPlatformType::class)],
            'description' => 'nullable|string|max:255',
            'icon_url' => 'required|url:http,https',
            'account_id' => 'required|unique:provider_platforms,account_id',
            'access_key' => 'required|unique:provider_platforms,access_key',
            'base_url' => 'required|url:http,https',
            'state' => [Rule::enum(ProviderPlatformState::class)],
        ];
    }
}
