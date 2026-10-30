<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class BusinessDiscountRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('code')) {
            $this->merge(['code' => strtolower(trim((string) $this->input('code')))]);
        }
        if ($this->has('name')) {
            $this->merge(['name' => trim((string) $this->input('name'))]);
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $discountId = $this->route('discount');
        $uniqueCode = Rule::unique('discounts', 'normalized_code')
            ->where('restaurant_id', (int) $this->route('restaurant'));
        if ($discountId !== null) {
            $uniqueCode->ignore((int) $discountId);
        }

        return [
            'code' => ['required', 'string', 'max:64', 'alpha_dash:ascii', $uniqueCode],
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:2000'],
            'type' => ['required', Rule::in(['percentage', 'fixed', 'free_delivery'])],
            'first_order_only' => ['required', 'boolean'],
            'value' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
            'min_order_amount' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
            'max_discount' => ['nullable', 'numeric', 'gt:0', 'max:99999999.99'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
            'usage_limit' => ['nullable', 'integer', 'min:1', 'max:4294967295'],
            'per_customer_limit' => ['required', 'integer', 'min:1', 'max:65535'],
            'is_active' => ['required', 'boolean'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $type = $this->input('type');
            $value = $this->input('value');
            if ($type === 'percentage' && $value !== null && ((float) $value < 1 || (float) $value > 100)) {
                $validator->errors()->add('value', 'Percentage discounts must be between 1 and 100.');
            }
            if ($type === 'fixed' && $value !== null && (float) $value <= 0) {
                $validator->errors()->add('value', 'Fixed discounts must be greater than zero.');
            }
            if ($type === 'free_delivery' && $value !== null && (float) $value !== 0.0) {
                $validator->errors()->add('value', 'This discount type does not use a value; enter 0.');
            }
            if ($type !== 'percentage' && $this->filled('max_discount')) {
                $validator->errors()->add('max_discount', 'A maximum discount applies only to percentage discounts.');
            }
        });
    }
}
