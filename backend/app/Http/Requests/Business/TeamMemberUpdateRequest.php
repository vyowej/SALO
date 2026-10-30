<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;
use Illuminate\Validation\Rule;

class TeamMemberUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'position' => ['sometimes', Rule::in(['manager', 'reservation_manager', 'staff'])],
            'status' => ['sometimes', Rule::in(['active', 'suspended'])],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($this->input('position') === null && $this->input('status') === null) {
                $validator->errors()->add('position', 'Choose a position or status change.');
            }
            if ($this->input('position') !== null && $this->input('status') !== null) {
                $validator->errors()->add('position', 'Change one membership field at a time.');
            }
        });
    }
}
