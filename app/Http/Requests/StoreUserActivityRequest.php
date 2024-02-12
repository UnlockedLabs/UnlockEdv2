<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreUserActivityRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        // Check if the authenticated user is an admin
        if ($this->user() && $this->user()->isAdmin()) {
            return true; // Admins can create records for any users
        }

        // Check if the 'user_id' in the request matches the authenticated user's ID
        return $this->user() && $this->user()->id == $this->input('user_id');
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
            'browser_name' => 'required|string|max:255',
            'platform' => 'required|string|max:255',
            'device' => 'required|string|max:255',
            'ip' => 'required|ip',
            'clicked_url' => 'required|url',
        ];
    }
}
