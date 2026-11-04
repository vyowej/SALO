<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AdminAccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        if ($this->isMethod('GET')) {
            return [
                'page' => ['sometimes', 'integer', 'min:1'],
                'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
                'search' => ['sometimes', 'string', 'max:200'],
                'status' => ['sometimes', 'in:active,suspended'],
            ];
        }

        if ($this->isMethod('PATCH')) {
            return ['status' => ['required', 'in:active,suspended']];
        }

        $userId = $this->route('user');
        $email = [
            $this->isMethod('POST') ? 'required' : 'sometimes',
            'string',
            'email',
            'max:190',
            Rule::unique('users', 'email')->ignore($userId),
        ];

        return [
            'name' => [$this->isMethod('POST') ? 'required' : 'sometimes', 'string', 'max:120'],
            'email' => $email,
            'phone' => ['sometimes', 'nullable', 'string', 'max:20'],
            'password' => [
                $this->isMethod('POST') ? 'required' : 'prohibited',
                'string',
                'confirmed',
                'min:8',
                'regex:/[A-Za-z]/',
                'regex:/\d/',
            ],
            'password_confirmation' => [$this->isMethod('POST') ? 'required' : 'prohibited', 'string'],
        ];
    }
}
