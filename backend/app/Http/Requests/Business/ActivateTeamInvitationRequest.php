<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;

class ActivateTeamInvitationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:80'],
            'last_name' => ['required', 'string', 'max:80'],
            'password' => ['required', 'string', 'confirmed', 'min:8', 'regex:/[A-Za-z]/', 'regex:/\d/'],
        ];
    }
}
