<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;

class OwnershipTransferRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'manager_id' => ['required', 'integer', 'min:1'],
            'password' => ['required', 'string', 'current_password'],
        ];
    }
}
