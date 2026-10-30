<?php

namespace App\Http\Requests\Applications;

use Illuminate\Foundation\Http\FormRequest;

class UploadApplicationDocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'doc_type' => ['required', 'in:business_permit,dti_sec_registration,owner_valid_id'],
            'file' => ['required', 'file', 'max:2048', 'mimes:pdf,jpg,jpeg,png,webp'],
            'expiry_date' => ['sometimes', 'nullable', 'date'],
        ];
    }
}
