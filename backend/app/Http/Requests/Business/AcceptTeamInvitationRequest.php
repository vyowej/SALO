<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;

class AcceptTeamInvitationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [];
    }
}
