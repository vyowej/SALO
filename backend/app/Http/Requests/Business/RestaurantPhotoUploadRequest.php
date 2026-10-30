<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;

class RestaurantPhotoUploadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'kind' => ['required', 'in:logo,cover,gallery'],
            'file' => ['required', 'file', 'max:2048', 'mimes:jpg,jpeg,png,webp'],
            'thumbnail' => ['required', 'file', 'max:2048', 'mimes:jpg,jpeg,png,webp'],
            'medium' => ['required', 'file', 'max:2048', 'mimes:jpg,jpeg,png,webp'],
            'alt_text' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }
}
