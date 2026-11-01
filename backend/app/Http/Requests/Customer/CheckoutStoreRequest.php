<?php

namespace App\Http\Requests\Customer;

class CheckoutStoreRequest extends CheckoutQuoteRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge(['idempotency_key' => $this->header('Idempotency-Key')]);
    }

    public function rules(): array
    {
        return array_merge(parent::rules(), [
            'idempotency_key' => ['required', 'string', 'max:64'],
            'orders.*.recipient_name' => ['required', 'string', 'max:120'],
            'orders.*.recipient_phone' => ['required', 'string', 'max:20'],
        ]);
    }

    public function idempotencyKey(): string
    {
        return (string) $this->header('Idempotency-Key');
    }
}
