<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;

class MenuHalalCertificateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:2048', 'mimes:pdf,jpg,jpeg,png,webp'],
            'expiry_date' => ['sometimes', 'nullable', 'date', 'after_or_equal:today'],
        ];
    }
}
