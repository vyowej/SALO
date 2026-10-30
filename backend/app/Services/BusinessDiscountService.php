<?php

namespace App\Services;

use App\Models\Discount;
use App\Models\Restaurant;
use App\Models\User;
use App\Repositories\Contracts\AuditLogRepository;
use App\Repositories\Contracts\BusinessDiscountRepository;
use App\Repositories\Contracts\RestaurantPageRepository;
use Illuminate\Support\Facades\DB;

class BusinessDiscountService
{
    public function __construct(
        private readonly BusinessDiscountRepository $discounts,
        private readonly RestaurantPageRepository $restaurants,
        private readonly AuditLogRepository $audit,
    ) {}

    public function list(Restaurant $restaurant, array $filters): array
    {
        $page = $this->discounts->paginate($restaurant, $filters);

        return [
            'data' => $page->getCollection()
                ->map(fn (Discount $discount): array => $this->discountArray($discount))
                ->all(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'last_page' => $page->lastPage(),
            ],
        ];
    }

    public function create(Restaurant $restaurant, User $actor, array $data): array
    {
        return DB::transaction(function () use ($restaurant, $actor, $data): array {
            $lockedRestaurant = $this->restaurants->lockRestaurant((int) $restaurant->getKey());
            $attributes = $this->attributes($data);
            $discount = $this->discounts->create($lockedRestaurant, [
                ...$attributes,
                'created_by' => $actor->getKey(),
                'funded_by' => 'restaurant',
            ]);
            $after = $this->discountArray($discount);
            $this->record($actor, $lockedRestaurant, 'discount.created', (string) $discount->getKey(), null, $after);

            return $after;
        });
    }

    public function update(Restaurant $restaurant, User $actor, int $discountId, array $data): array
    {
        return DB::transaction(function () use ($restaurant, $actor, $discountId, $data): array {
            $lockedRestaurant = $this->restaurants->lockRestaurant((int) $restaurant->getKey());
            $discount = $this->discounts->lockForRestaurant($lockedRestaurant, $discountId);
            abort_unless($discount instanceof Discount, 404);
            $before = $this->discountArray($discount);
            $updated = $this->discounts->update($discount, $this->attributes($data));
            $after = $this->discountArray($updated);
            if ($before !== $after) {
                $this->record($actor, $lockedRestaurant, 'discount.updated', (string) $discountId, $before, $after);
            }

            return $after;
        });
    }

    public function deactivate(Restaurant $restaurant, User $actor, int $discountId): void
    {
        DB::transaction(function () use ($restaurant, $actor, $discountId): void {
            $lockedRestaurant = $this->restaurants->lockRestaurant((int) $restaurant->getKey());
            $discount = $this->discounts->lockForRestaurant($lockedRestaurant, $discountId);
            abort_unless($discount instanceof Discount, 404);
            if (! $discount->is_active) {
                return;
            }

            $before = $this->discountArray($discount);
            $updated = $this->discounts->update($discount, ['is_active' => false]);
            $this->record(
                $actor,
                $lockedRestaurant,
                'discount.deactivated',
                (string) $discountId,
                $before,
                $this->discountArray($updated),
            );
        });
    }

    private function attributes(array $data): array
    {
        return [
            'code' => strtoupper(trim($data['code'])),
            'name' => trim($data['name']),
            'description' => isset($data['description']) ? trim($data['description']) ?: null : null,
            'type' => $data['type'],
            'first_order_only' => (bool) $data['first_order_only'],
            'value' => $data['value'],
            'min_order_amount' => $data['min_order_amount'],
            'max_discount' => $data['max_discount'] ?? null,
            'starts_at' => $data['starts_at'],
            'ends_at' => $data['ends_at'],
            'usage_limit' => $data['usage_limit'] ?? null,
            'per_customer_limit' => $data['per_customer_limit'],
            'is_active' => (bool) $data['is_active'],
        ];
    }

    private function discountArray(Discount $discount): array
    {
        return [
            'id' => (string) $discount->getKey(),
            'code' => $discount->code,
            'name' => $discount->name,
            'description' => $discount->description,
            'funded_by' => $discount->funded_by,
            'type' => $discount->type,
            'first_order_only' => (bool) $discount->first_order_only,
            'value' => $discount->value,
            'min_order_amount' => $discount->min_order_amount,
            'max_discount' => $discount->max_discount,
            'starts_at' => $discount->starts_at?->toISOString(),
            'ends_at' => $discount->ends_at?->toISOString(),
            'usage_limit' => $discount->usage_limit,
            'per_customer_limit' => $discount->per_customer_limit,
            'usage_count' => (int) ($discount->usage_count ?? $discount->redemptions()->where('status', 'applied')->count()),
            'is_active' => (bool) $discount->is_active,
        ];
    }

    private function record(
        User $actor,
        Restaurant $restaurant,
        string $action,
        string $entityId,
        ?array $before,
        ?array $after,
    ): void {
        $this->audit->record([
            'actor_user_id' => $actor->getKey(),
            'restaurant_id' => $restaurant->getKey(),
            'action' => $action,
            'entity_type' => 'discount',
            'entity_id' => $entityId,
            'before_value' => $before,
            'after_value' => $after,
            'created_at' => now(),
        ]);
    }
}
