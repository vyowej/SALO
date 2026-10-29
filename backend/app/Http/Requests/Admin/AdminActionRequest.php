<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class AdminActionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $uri = $this->route()->uri();
        $resource = $this->route('resource');
        if ($resource === 'users') {
            return [
                'name' => [$this->isMethod('POST') ? 'required' : 'sometimes', 'string', 'max:120'],
                'email' => [$this->isMethod('POST') ? 'required' : 'sometimes', 'email', 'max:255'],
                'phone' => ['sometimes', 'nullable', 'string', 'max:32'],
                'capabilities' => [$this->isMethod('POST') ? 'required' : 'sometimes', 'array'],
                'capabilities.*' => ['in:customer,driver,admin'],
                'password' => [$this->isMethod('POST') ? 'required' : 'sometimes', 'string', 'min:8'],
                'role' => ['prohibited'],
            ];
        }
        if ($resource === 'restaurants') {
            return [
                'name' => [$this->isMethod('POST') ? 'required' : 'sometimes', 'string', 'max:120'],
                'slug' => ['sometimes', 'string', 'max:160'],
                'description' => ['sometimes', 'nullable', 'string'],
                'phone' => ['sometimes', 'nullable', 'string', 'max:32'],
                'email' => ['sometimes', 'nullable', 'email'],
                'status' => ['sometimes', 'in:pending,active,paused,suspended'],
                'address' => ['sometimes', 'array'],
                'address.street_line' => ['sometimes', 'nullable', 'string', 'max:255'],
                'address.city_code' => ['sometimes', 'nullable', 'string', 'max:32'],
                'address.city_name' => ['sometimes', 'nullable', 'string', 'max:120'],
                'address.latitude' => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
                'address.longitude' => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
                'categories' => ['sometimes', 'array'],
                'categories.*' => ['string', 'max:80'],
                'logo_ref' => ['sometimes', 'nullable', 'string', 'max:255'],
                'cover_ref' => ['sometimes', 'nullable', 'string', 'max:255'],
                'accepts_delivery' => ['sometimes', 'boolean'],
                'accepts_pickup' => ['sometimes', 'boolean'],
                'accepts_reservations' => ['sometimes', 'boolean'],
            ];
        }
        if (str_contains($uri, 'cancel')) {
            return ['reason' => ['required', 'string', 'min:1', 'max:500']];
        }
        if (str_contains($uri, 'reservations/{id}/status')) {
            return ['status' => ['required', 'in:pending,confirmed,seated,completed,cancelled,no_show'], 'reason' => ['nullable', 'required_if:status,cancelled', 'string', 'max:500']];
        }
        if (str_contains($uri, 'applications/{type}/{id}/reject')) {
            return ['note' => ['required', 'string', 'min:1', 'max:500']];
        }
        if (str_contains($uri, 'applications/{type}/{id}/approve')) {
            return ['note' => ['sometimes', 'nullable', 'string', 'max:500']];
        }
        if (str_contains($uri, 'restaurants/{id}/status')) {
            return ['status' => ['required', 'in:pending,active,paused,suspended'], 'note' => ['sometimes', 'nullable', 'string', 'max:500']];
        }
        if (str_contains($uri, 'riders/{id}/status')) {
            return ['status' => ['required', 'in:active,suspended']];
        }
        if (str_contains($uri, 'suspend')) {
            return ['reason' => ['sometimes', 'nullable', 'string', 'max:500']];
        }
        if ($resource === 'service-areas') {
            return [
                'name' => [$this->isMethod('POST') ? 'required' : 'sometimes', 'string', 'max:120'],
                'city_code' => ['required', 'string'],
                'latitude' => ['required', 'numeric', 'between:-90,90'],
                'longitude' => ['required', 'numeric', 'between:-180,180'],
                'max_riders' => ['required', 'integer', 'min:1'],
                'is_active' => ['sometimes', 'boolean'],
            ];
        }
        if (str_contains($uri, 'schedules/generate')) {
            return ['date' => ['required', 'date'], 'slots' => ['sometimes', 'array'], 'slots.*.start_time' => ['required_with:slots', 'date_format:H:i'], 'slots.*.end_time' => ['required_with:slots', 'date_format:H:i', 'after:slots.*.start_time']];
        }
        if ($resource === 'settings') {
            return ['app_name' => ['sometimes', 'string', 'max:100'], 'default_delivery_fee' => ['sometimes', 'numeric', 'min:0'], 'max_riders_per_area' => ['sometimes', 'integer', 'min:1'], 'rider_slots' => ['sometimes', 'array']];
        }

        return [];
    }
}
