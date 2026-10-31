<?php

namespace App\Services;

use App\Models\PsgcLocation;
use Illuminate\Validation\ValidationException;

class AddressFormatter
{
    public function format(PsgcLocation $location, string $street, ?string $houseNumber): string
    {
        $hierarchy = [];
        $visited = [];
        $current = $location;

        while ($current !== null && ! isset($visited[$current->code])) {
            $visited[$current->code] = true;
            $hierarchy[] = trim($current->name);
            $current = $current->parent;
        }

        $parts = [
            'Philippines',
            ...array_reverse($hierarchy),
            trim($street),
            trim((string) $houseNumber),
        ];

        $formatted = implode(', ', array_values(array_filter(
            $parts,
            static fn (string $part): bool => $part !== '',
        )));

        if (mb_strlen($formatted) > 300) {
            throw ValidationException::withMessages([
                'formatted_address' => ['The formatted address exceeds 300 characters.'],
            ]);
        }

        return $formatted;
    }
}
