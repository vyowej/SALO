<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class ResetPasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:254'],
            'token' => ['required', 'string'],
            'password' => ['required', 'string', 'confirmed', 'min:8', 'regex:/[A-Za-z]/', 'regex:/\d/'],
        ];
    }
}
