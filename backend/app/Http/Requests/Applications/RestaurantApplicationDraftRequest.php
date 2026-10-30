<?php

namespace App\Http\Requests\Applications;

use Illuminate\Foundation\Http\FormRequest;

class RestaurantApplicationDraftRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $details = $this->input('draft_details');
        if (! is_array($details)) {
            return;
        }

        unset(
            $details['business_email_verified'],
            $details['business_email_verified_email'],
            $details['business_email_verified_at'],
            $details['logo_path'],
            $details['cover_path'],
        );
        $this->merge(['draft_details' => $details]);
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'draft_details' => [
                'required',
                'array:restaurant_name,cuisine,category,description,contact_number,business_email,region_code,province_code,city_code,barangay_code,psgc_code,street,latitude,longitude,pin_confirmed,hours,is_24_7,declared_bir_2303,current_step',
            ],
            'draft_details.restaurant_name' => ['sometimes', 'required', 'string', 'max:160'],
            'draft_details.cuisine' => ['sometimes', 'nullable', 'string', 'max:100'],
            'draft_details.category' => ['sometimes', 'required', 'string', 'max:100'],
            'draft_details.description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'draft_details.contact_number' => ['sometimes', 'required', 'string', 'max:40'],
            'draft_details.business_email' => ['sometimes', 'required', 'email', 'max:254'],
            'draft_details.region_code' => ['sometimes', 'nullable', 'string', 'max:10', 'exists:psgc_locations,code'],
            'draft_details.province_code' => ['sometimes', 'nullable', 'string', 'max:10', 'exists:psgc_locations,code'],
            'draft_details.city_code' => ['sometimes', 'nullable', 'string', 'max:10', 'exists:psgc_locations,code'],
            'draft_details.barangay_code' => ['sometimes', 'nullable', 'string', 'max:10', 'exists:psgc_locations,code'],
            'draft_details.psgc_code' => ['sometimes', 'nullable', 'string', 'max:10', 'exists:psgc_locations,code'],
            'draft_details.street' => ['sometimes', 'required', 'string', 'max:255'],
            'draft_details.latitude' => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'draft_details.longitude' => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
            'draft_details.pin_confirmed' => ['sometimes', 'boolean'],
            'draft_details.hours' => ['sometimes', 'array:monday,tuesday,wednesday,thursday,friday,saturday,sunday'],
            'draft_details.hours.*' => ['array', 'max:4'],
            'draft_details.hours.*.*.open_time' => ['required_with:draft_details.hours.*.*', 'date_format:H:i'],
            'draft_details.hours.*.*.close_time' => ['required_with:draft_details.hours.*.*', 'date_format:H:i'],
            'draft_details.hours.*.*.crosses_midnight' => ['required_with:draft_details.hours.*.*', 'boolean'],
            'draft_details.is_24_7' => ['sometimes', 'boolean'],
            'draft_details.declared_bir_2303' => ['sometimes', 'boolean'],
            'draft_details.current_step' => ['sometimes', 'integer', 'between:0,4'],
        ];
    }
}
