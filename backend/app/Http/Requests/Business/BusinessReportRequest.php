<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class BusinessReportRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge(['report' => $this->route('report')]);
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
            'report' => [
                'required',
                Rule::in(['sales_summary', 'orders_by_status', 'popular_items', 'discount_usage', 'reservations', 'no_show_rate']),
            ],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($this->filled('from') && $this->filled('to')) {
                $from = strtotime((string) $this->input('from'));
                $to = strtotime((string) $this->input('to'));
                if ($from !== false && $to !== false && $to - $from >= 366 * 86400) {
                    $validator->errors()->add('to', 'The report date range cannot exceed 366 days.');
                }
            }
        });
    }
}
