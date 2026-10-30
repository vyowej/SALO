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
            ->get(['code', 'parent_code', 'name', 'level'])
            ->map(fn (PsgcLocation $location): array => [
                'code' => $location->code,
                'parent_code' => $location->parent_code,
                'name' => $location->name,
            ])
            ->all();
    }

    public function upsert(array $locations): void
    {
        DB::transaction(function () use ($locations): void {
            $levels = ['region' => 1, 'province' => 2, 'city' => 3, 'barangay' => 4];
            usort($locations, fn (array $first, array $second): int => $levels[$first['level']] <=> $levels[$second['level']]);

            foreach ($locations as $location) {
                PsgcLocation::query()->updateOrCreate(
                    ['code' => $location['code']],
                    [
                        'parent_code' => $location['parent_code'],
                        'name' => $location['name'],
                        'level' => $location['level'],
                    ],
                );
            }
        });
    }
}
