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

    public function hierarchyForCode(string $code): ?array
    {
        $location = PsgcLocation::query()
            ->with('parent.parent.parent.parent')
            ->find($code);
        if ($location === null) {
            return null;
        }

        $hierarchy = [];
        $current = $location;
        while ($current !== null) {
            $hierarchy[] = [
                'code' => (string) $current->code,
                'parent_code' => $current->parent_code === null ? null : (string) $current->parent_code,
                'name' => $current->name,
                'level' => $current->level,
            ];
            $current = $current->parent;
        }

        return $hierarchy;
    }

    public function upsert(array $locations): void
    {
        $locations = array_map(static function (array $location): array {
            $location['parent_code'] = $location['parent_code'] === '' ? null : $location['parent_code'];

            return $location;
        }, $locations);

        DB::transaction(function () use ($locations): void {
            foreach (array_chunk($locations, 500) as $chunk) {
                PsgcLocation::query()->upsert(
                    $chunk,
                    ['code'],
                    ['parent_code', 'name', 'level', 'full_name'],
                );
            }
        });
    }

    public function verificationReport(): array
    {
        $counts = DB::table('psgc_locations')
            ->select('level', DB::raw('COUNT(*) AS row_count'))
            ->groupBy('level')
            ->pluck('row_count', 'level')
            ->all();

        $missingParents = DB::table('psgc_locations as child')
            ->leftJoin('psgc_locations as parent', 'parent.code', '=', 'child.parent_code')
            ->where(function ($query): void {
                $query->where(function ($query): void {
                    $query->where('child.level', '<>', 'region')
                        ->whereNull('child.parent_code');
                })->orWhere(function ($query): void {
                    $query->whereNotNull('child.parent_code')
                        ->whereNull('parent.code');
                });
            })
            ->count();

        $wrongParents = DB::table('psgc_locations as child')
            ->leftJoin('psgc_locations as parent', 'parent.code', '=', 'child.parent_code')
            ->where(function ($query): void {
                $query->where(function ($query): void {
                    $query->where('child.level', 'region')
                        ->whereNotNull('parent.code');
                })->orWhere(function ($query): void {
                    $query->where('child.level', 'province')
                        ->whereNotNull('parent.code')
                        ->where('parent.level', '<>', 'region');
                })->orWhere(function ($query): void {
                    $query->where('child.level', 'city')
                        ->whereNotNull('parent.code')
                        ->whereNotIn('parent.level', ['region', 'province']);
                })->orWhere(function ($query): void {
                    $query->where('child.level', 'barangay')
                        ->whereNotNull('parent.code')
                        ->where('parent.level', '<>', 'city');
                })->orWhere(function ($query): void {
                    $query->where('child.level', 'district')
                        ->whereNotNull('parent.code')
                        ->where('parent.level', '<>', 'region');
                })->orWhere(function ($query): void {
                    $query->where('child.level', 'submunicipality')
                        ->whereNotNull('parent.code')
                        ->where('parent.level', '<>', 'city');
                })->orWhere(function ($query): void {
                    $query->whereNotIn('child.level', [
                        'region',
                        'province',
                        'city',
                        'barangay',
                        'district',
                        'submunicipality',
                    ])->whereNotNull('parent.code');
                });
            })
            ->count();

        return [
            'counts' => array_replace(
                array_fill_keys(['region', 'province', 'city', 'barangay', 'district', 'submunicipality'], 0),
                $counts,
            ),
            'missing_parent_count' => $missingParents,
            'wrong_parent_count' => $wrongParents,
            'invalid_parent_count' => $missingParents + $wrongParents,
        ];
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
