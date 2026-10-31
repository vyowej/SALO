<?php

namespace App\Repositories\Database;

use App\Models\PsgcLocation;
use App\Repositories\Contracts\PsgcLocationRepository;
use Illuminate\Support\Facades\DB;

class DatabasePsgcLocationRepository implements PsgcLocationRepository
{
    public function listByLevelParent(string $level, ?string $parentCode, ?string $search): array
    {
        $query = PsgcLocation::query()->where('level', $level);
        if ($parentCode !== null && $parentCode !== '') {
            $query->where('parent_code', $parentCode);
        }
        if ($search !== null && trim($search) !== '') {
            $query->where('name', 'like', '%'.trim($search).'%');
        }

        return $query->orderBy('name')
            ->limit(1000)
            ->get(['code', 'parent_code', 'name', 'level', 'full_name'])
            ->map(fn (PsgcLocation $location): array => [
                'code' => $location->code,
                'parent_code' => $location->parent_code,
                'name' => $location->name,
                'level' => $location->level,
                'full_name' => $location->full_name,
            ])
            ->all();
    }

    public function search(string $query): array
    {
        $query = trim($query);
        $tokens = preg_split('/\s+/u', preg_replace('/[^\pL\pN]+/u', ' ', $query), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $fullTextQuery = implode(' ', array_map(fn (string $token): string => '+'.$token.'*', $tokens));
        $locations = PsgcLocation::query()
            ->where(function ($builder) use ($query, $fullTextQuery): void {
                $builder->where('name', 'like', $query.'%')
                    ->orWhereRaw('MATCH(name, full_name) AGAINST (? IN BOOLEAN MODE)', [$fullTextQuery]);
            })
            ->orderByRaw('CASE WHEN name LIKE ? THEN 0 ELSE 1 END', [$query.'%'])
            ->orderBy('full_name')
            ->limit(30)
            ->with('parent.parent.parent')
            ->get(['code', 'parent_code', 'name', 'level', 'full_name']);

        return $locations->map(fn (PsgcLocation $location): array => [
            'code' => $location->code,
            'parent_code' => $location->parent_code,
            'name' => $location->name,
            'level' => $location->level,
            'full_name' => $location->full_name,
            'region' => $this->ancestorName($location, 'region'),
            'province' => $this->ancestorName($location, 'province'),
            'city_municipality' => $this->ancestorName($location, 'city'),
            'barangay' => $this->ancestorName($location, 'barangay'),
            'region_code' => $this->ancestorCode($location, 'region'),
            'province_code' => $this->ancestorCode($location, 'province'),
            'city_code' => $this->ancestorCode($location, 'city'),
            'barangay_code' => $this->ancestorCode($location, 'barangay'),
        ])->all();
    }

    public function upsert(array $locations): void
    {
        DB::transaction(function () use ($locations): void {
            foreach ($locations as $location) {
                PsgcLocation::query()->updateOrCreate(
                    ['code' => $location['code']],
                    [
                        'parent_code' => $location['parent_code'],
                        'name' => $location['name'],
                        'level' => $location['level'],
                        'full_name' => $location['full_name'],
                    ],
                );
            }
        });
    }

    private function ancestorName(PsgcLocation $location, string $level): string
    {
        $current = $location;
        while ($current !== null) {
            if ($current->level === $level) {
                return $current->name;
            }
            $current = $current->parent;
        }

        return '';
    }

    private function ancestorCode(PsgcLocation $location, string $level): ?string
    {
        $current = $location;
        while ($current !== null) {
            if ($current->level === $level) {
                return $current->code;
            }
            $current = $current->parent;
        }

        return null;
    }
}
