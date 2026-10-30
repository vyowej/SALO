<?php

namespace App\Http\Requests\Applications;

use Illuminate\Foundation\Http\FormRequest;

class UploadApplicationPhotoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'kind' => ['required', 'in:logo,cover'],
            'file' => ['required', 'file', 'max:2048', 'mimes:jpg,jpeg,png,webp'],
        ];
    }
}
