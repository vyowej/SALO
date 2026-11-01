<?php

namespace App\Exceptions;

use RuntimeException;

class CartValidationException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly array $fields,
        public readonly string $errorCode = 'CART_VALIDATION_FAILED',
        public readonly int $httpStatus = 422,
    ) {
        parent::__construct($message);
    }
}
