<?php

namespace App\Services;

use App\Models\ClosureDate;
use App\Models\Restaurant;
use App\Models\RestaurantApplication;
use App\Models\RestaurantPhoto;
use App\Models\User;
use App\Repositories\Contracts\ApplicationDocumentRepository;
use App\Repositories\Contracts\AuditLogRepository;
use App\Repositories\Contracts\MenuRepository;
use App\Repositories\Contracts\RestaurantApplicationRepository;
use App\Repositories\Contracts\RestaurantPageRepository;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class RestaurantPageService
{
    private const WEEKDAYS = [
        'monday' => 1,
        'tuesday' => 2,
        'wednesday' => 3,
        'thursday' => 4,
        'friday' => 5,
        'saturday' => 6,
        'sunday' => 7,
    ];

    public function __construct(
        private readonly RestaurantPageRepository $pages,
        private readonly RestaurantApplicationRepository $applications,
        private readonly ApplicationDocumentRepository $documents,
        private readonly AuditLogRepository $audit,
        private readonly MenuRepository $menus,
        private readonly PrivateDocumentStorageService $privateFiles,
        private readonly PublicPhotoStorageService $publicPhotos,
    ) {}

    public function profile(Restaurant $restaurant): array
    {
        return [
            'restaurant' => $this->pages->profile($restaurant),
            'hours' => $this->hours($restaurant),
            'closures' => $this->pages->closures($restaurant, null, null)->map(fn (ClosureDate $closure): array => $this->closureArray($closure))->all(),
            'open_now' => $this->isOpenNow($restaurant),
            'pending_sensitive_update' => $this->pendingSensitiveUpdate($restaurant),
        ];
    }

    public function updateProfile(Restaurant $restaurant, User $actor, array $data): array
    {
        return DB::transaction(function () use ($restaurant, $actor, $data): array {
            $locked = $this->pages->lockRestaurant((int) $restaurant->getKey());
            $beforeProfile = $this->pages->profile($locked);
            $attributes = array_intersect_key($data, array_flip([
                'name',
                'description',
                'contact_number',
                'delivery_radius_km',
                'prep_minutes',
            ]));
            $before = array_intersect_key($beforeProfile, $attributes);
            $before['category'] = $beforeProfile['category'];
            $before['cuisine'] = $beforeProfile['cuisine'];

            if (array_key_exists('category', $data) || array_key_exists('cuisine', $data)) {
                $currentCuisines = $this->pages->cuisineNames($locked);
                $category = array_key_exists('category', $data)
                    ? trim((string) $data['category'])
                    : ($currentCuisines[0] ?? '');
                $cuisineNames = array_key_exists('cuisine', $data)
                    ? $this->parseCuisineNames((string) $data['cuisine'])
                    : array_slice($currentCuisines, 1);
                $this->pages->syncCuisines($locked, array_merge([$category], $cuisineNames));
            }
            if ($attributes !== []) {
                $locked = $this->pages->updateRestaurant($locked, $attributes);
            }
            $afterProfile = $this->pages->profile($locked);
            $after = [];
            foreach ($before as $field => $value) {
                $after[$field] = $afterProfile[$field];
            }
            if ($before !== $after) {
                $this->record($actor, $locked, 'profile.updated', 'restaurant', (string) $locked->getKey(), $before, $after);
            }

            return $this->profile($locked);
        });
    }

    public function proposeSensitiveUpdate(
        Restaurant $restaurant,
        User $actor,
        array $changes,
        array $permitFiles,
        ?string $permitExpiryDate,
    ): array {
        abort_unless((int) $restaurant->owner_user_id === (int) $actor->getKey(), 403);
        $allowed = ['legal_name', 'psgc_code', 'street', 'house_no', 'latitude', 'longitude'];
        $changes = array_intersect_key($changes, array_flip($allowed));
        if (array_key_exists('latitude', $changes) !== array_key_exists('longitude', $changes)) {
            throw ValidationException::withMessages([
                'proposed_changes.latitude' => ['Submit latitude and longitude together as one confirmed pin.'],
            ]);
        }
        if ($changes === [] && $permitFiles === []) {
            throw ValidationException::withMessages([
                'proposed_changes' => ['Provide at least one sensitive change or replacement permit.'],
            ]);
        }

        $storedPaths = [];
        try {
            return DB::transaction(function () use (
                $restaurant,
                $actor,
                $changes,
                $permitFiles,
                $permitExpiryDate,
                &$storedPaths,
            ): array {
                $locked = $this->pages->lockRestaurant((int) $restaurant->getKey());
                $pending = $this->applications->findPendingSensitiveUpdate((int) $locked->getKey());
                if ($pending !== null && ! in_array($pending->status, ['draft', 'needs_revision'], true)) {
                    throw ValidationException::withMessages([
                        'status' => ['A sensitive update is already pending Admin review.'],
                    ]);
                }

                $proposed = array_replace($pending?->proposed_changes ?? [], $changes);
                $application = $pending === null
                    ? $this->applications->create([
                        'restaurant_id' => $locked->getKey(),
                        'submitted_by' => $actor->getKey(),
                        'application_type' => 'sensitive_update',
                        'status' => 'submitted',
                        'proposed_changes' => $proposed,
                        'submitted_at' => now(),
                    ])
                    : $this->applications->updateSensitiveChanges($pending, $proposed);

                foreach ($permitFiles as $file) {
                    if (! $file instanceof UploadedFile) {
                        continue;
                    }
                    $path = $this->privateFiles->store($file);
                    $storedPaths[] = $path;
                    $this->documents->create([
                        'application_id' => $application->getKey(),
                        'doc_type' => 'business_permit',
                        'private_path' => $path,
                        'expiry_date' => $permitExpiryDate,
                        'verification_state' => 'pending',
                    ]);
                }

                $application->load('documents');
                $before = array_intersect_key($locked->getAttributes(), $changes);
                $after = $proposed;
                if ($storedPaths !== []) {
                    $after['permit_documents'] = $application->documents
                        ->map(fn ($document): array => [
                            'id' => (string) $document->getKey(),
                            'doc_type' => $document->doc_type,
                            'expiry_date' => $document->expiry_date?->toDateString(),
                        ])->all();
                }
                $this->record(
                    $actor,
                    $locked,
                    'sensitive_update.submitted',
                    'restaurant_application',
                    (string) $application->getKey(),
                    $before,
                    $after,
                );

                return $this->applications->toArray($application);
            });
        } catch (\Throwable $exception) {
            foreach ($storedPaths as $path) {
                if (! Storage::disk('private')->delete($path)) {
                    throw new \RuntimeException('A staged private permit could not be removed after the proposal failed.', 0, $exception);
                }
            }
            throw $exception;
        }
    }

    public function preview(Restaurant $restaurant): array
    {
        $profile = $this->pages->profile($restaurant);

        return [
            'restaurant' => [
                'id' => $profile['id'],
                'name' => $profile['name'],
                'category' => $profile['category'],
                'description' => $profile['description'],
                'cuisine' => $profile['cuisine'],
                'contact_number' => $profile['contact_number'],
                'logo_url' => $profile['logo_url'],
                'cover_url' => $profile['cover_url'],
                'photos' => $profile['photos'],
                'status' => $profile['status'],
                'is_published' => $profile['is_published'],
                'is_24_7' => $profile['is_24_7'],
                'open_now' => $this->isOpenNow($restaurant),
            ],
            'hours' => $this->hours($restaurant),
        ];
    }

    public function photos(Restaurant $restaurant): array
    {
        $profile = $this->pages->profile($restaurant);

        return [
            'logo_url' => $profile['logo_url'],
            'cover_url' => $profile['cover_url'],
            'photos' => $profile['photos'],
        ];
    }

    public function uploadPhoto(
        Restaurant $restaurant,
        User $actor,
        string $kind,
        UploadedFile $file,
        UploadedFile $thumbnail,
        UploadedFile $medium,
        ?string $altText,
    ): array {
        $path = $this->publicPhotos->storeVariants($file, $thumbnail, $medium);
        $oldPath = null;
        try {
            $photo = DB::transaction(function () use (
                $restaurant,
                $actor,
                $kind,
                $path,
                $altText,
                &$oldPath,
            ): ?RestaurantPhoto {
                $locked = $this->pages->lockRestaurant((int) $restaurant->getKey());
                if ($kind === 'gallery') {
                    if ($this->pages->galleryPhotoCount($locked) >= 10) {
                        throw ValidationException::withMessages(['photos' => ['A restaurant can have at most 10 gallery photos.']]);
                    }
                    $photo = $this->pages->createPhoto($locked, [
                        'path' => $path,
                        'alt_text' => $altText,
                        'sort_order' => $this->pages->galleryPhotoCount($locked),
                        'is_primary' => false,
                    ]);
                    $this->record($actor, $locked, 'photo.gallery.added', 'restaurant_photo', (string) $photo->getKey(), null, [
                        'path' => $path,
                        'alt_text' => $photo->alt_text,
                        'sort_order' => $photo->sort_order,
                    ]);

                    return $photo;
                }

                $column = $kind === 'logo' ? 'logo_path' : 'cover_path';
                $oldPath = $locked->{$column};
                $updated = $this->pages->updateRestaurant($locked, [$column => $path]);
                $this->record(
                    $actor,
                    $updated,
                    'photo.'.$kind.'.changed',
                    'restaurant',
                    (string) $updated->getKey(),
                    [$column => $oldPath],
                    [$column => $path],
                );

                return null;
            });
        } catch (\Throwable $exception) {
            $this->publicPhotos->deleteVariants($path);
            throw $exception;
        }

        if ($oldPath !== null) {
            $this->publicPhotos->deleteVariants($oldPath);
        }

        if ($kind === 'gallery') {
            return ['photo' => $this->photoArray($photo)];
        }

        return $this->photos($restaurant->fresh());
    }

    public function updatePhoto(Restaurant $restaurant, User $actor, int $photoId, array $changes): array
    {
        return DB::transaction(function () use ($restaurant, $actor, $photoId, $changes): array {
            $locked = $this->pages->lockRestaurant((int) $restaurant->getKey());
            $photo = $this->pages->findPhoto($locked, $photoId);
            abort_unless($photo !== null, 404);
            $before = $photo->only(array_keys($changes));
            $previousPrimary = null;
            if (($changes['is_primary'] ?? false) === true) {
                $previousPrimary = $this->pages->photos($locked)
                    ->first(fn (RestaurantPhoto $candidate): bool => $candidate->is_primary
                        && (int) $candidate->getKey() !== $photoId);
                $this->pages->clearPrimaryPhoto($locked);
            }
            $updated = $this->pages->updatePhoto($photo, $changes);
            $after = $updated->only(array_keys($changes));
            if ($previousPrimary !== null) {
                $this->record(
                    $actor,
                    $locked,
                    'photo.gallery.primary_changed',
                    'restaurant_photo',
                    (string) $previousPrimary->getKey(),
                    ['is_primary' => true],
                    ['is_primary' => false],
                );
            }
            if ($before !== $after) {
                $this->record($actor, $locked, 'photo.gallery.updated', 'restaurant_photo', (string) $updated->getKey(), $before, $after);
            }

            return ['photo' => $this->photoArray($updated)];
        });
    }

    public function deletePhoto(Restaurant $restaurant, User $actor, string $photoId): ?array
    {
        if (in_array($photoId, ['logo', 'cover'], true)) {
            $column = $photoId.'_path';
            $oldPath = null;
            DB::transaction(function () use ($restaurant, $actor, $column, &$oldPath): void {
                $locked = $this->pages->lockRestaurant((int) $restaurant->getKey());
                $oldPath = $locked->{$column};
                if ($oldPath === null) {
                    return;
                }
                $this->pages->updateRestaurant($locked, [$column => null]);
                $this->record($actor, $locked, 'photo.'.$column.'.deleted', 'restaurant', (string) $locked->getKey(), [$column => $oldPath], [$column => null]);
            });
            $this->publicPhotos->deleteVariants($oldPath);

            return $this->photos($restaurant->fresh());
        }

        if (! ctype_digit($photoId)) {
            abort(404);
        }
        $path = null;
        DB::transaction(function () use ($restaurant, $actor, $photoId, &$path): void {
            $locked = $this->pages->lockRestaurant((int) $restaurant->getKey());
            $photo = $this->pages->findPhoto($locked, (int) $photoId);
            abort_unless($photo !== null, 404);
            $path = $photo->path;
            $before = $photo->only(['path', 'alt_text', 'sort_order', 'is_primary']);
            $this->pages->deletePhoto($photo);
            $this->record($actor, $locked, 'photo.gallery.deleted', 'restaurant_photo', $photoId, $before, null);
        });
        $this->publicPhotos->deleteVariants($path);

        return null;
    }

    public function hours(Restaurant $restaurant): array
    {
        $hours = [];
        foreach (array_keys(self::WEEKDAYS) as $day) {
            $hours[$day] = [];
        }
        foreach ($this->pages->hours($restaurant) as $shift) {
            $day = array_search((int) $shift->weekday, self::WEEKDAYS, true);
            if ($day === false) {
                continue;
            }
            $hours[$day][] = [
                'open_time' => substr((string) $shift->open_time, 0, 5),
                'close_time' => substr((string) $shift->close_time, 0, 5),
                'crosses_midnight' => (bool) $shift->crosses_midnight,
            ];
        }

        return ['is_24_7' => (bool) $restaurant->is_24_7, 'hours' => $hours];
    }

    public function updateHours(Restaurant $restaurant, User $actor, bool $is24Seven, array $hours): array
    {
        $normalized = $this->normalizeHours($hours);
        if (! $is24Seven) {
            $this->validateHours($normalized);
        }

        return DB::transaction(function () use ($restaurant, $actor, $is24Seven, $normalized): array {
            $locked = $this->pages->lockRestaurant((int) $restaurant->getKey());
            $before = $this->hours($locked);
            $this->pages->replaceHours($locked, $normalized);
            $locked = $this->pages->updateRestaurant($locked, ['is_24_7' => $is24Seven]);
            $after = $this->hours($locked);
            if ($before !== $after) {
                $this->record($actor, $locked, 'hours.updated', 'restaurant', (string) $locked->getKey(), $before, $after);
            }

            return $after;
        });
    }

    public function closures(Restaurant $restaurant, ?string $from, ?string $to): array
    {
        return $this->pages->closures($restaurant, $from, $to)
            ->map(fn (ClosureDate $closure): array => $this->closureArray($closure))
            ->all();
    }

    public function createClosure(Restaurant $restaurant, User $actor, array $data): array
    {
        return DB::transaction(function () use ($restaurant, $actor, $data): array {
            $locked = $this->pages->lockRestaurant((int) $restaurant->getKey());
            $closure = $this->pages->createClosure($locked, $data);
            $result = $this->closureArray($closure);
            $this->record($actor, $locked, 'closure.created', 'closure_date', (string) $closure->getKey(), null, $result);

            return $result;
        });
    }

    public function deleteClosure(Restaurant $restaurant, User $actor, int $closureId): void
    {
        DB::transaction(function () use ($restaurant, $actor, $closureId): void {
            $locked = $this->pages->lockRestaurant((int) $restaurant->getKey());
            $closure = $this->pages->findClosure($locked, $closureId);
            abort_unless($closure !== null, 404);
            $before = $this->closureArray($closure);
            $this->pages->deleteClosure($closure);
            $this->record($actor, $locked, 'closure.deleted', 'closure_date', (string) $closureId, $before, null);
        });
    }

    public function publishChecklist(Restaurant $restaurant): array
    {
        $profile = $this->pages->profile($restaurant);
        $hours = $this->hours($restaurant);
        $checks = [
            'approved' => [
                'label' => 'Restaurant is approved',
                'complete' => $restaurant->status === 'approved',
            ],
            'pinned_address' => [
                'label' => 'Restaurant address and map pin are set',
                'complete' => trim((string) $restaurant->psgc_code) !== ''
                    && trim((string) $restaurant->street) !== ''
                    && $restaurant->latitude !== null
                    && $restaurant->longitude !== null,
            ],
            'hours' => [
                'label' => 'Operating hours are set, or restaurant is open 24/7',
                'complete' => $hours['is_24_7'] || collect($hours['hours'])->contains(fn ($shifts): bool => $shifts !== []),
            ],
            'category' => [
                'label' => 'Restaurant category is set',
                'complete' => trim((string) $profile['category']) !== '',
            ],
            'orderable_item' => [
                'label' => 'At least one published, orderable menu item exists',
                'complete' => $this->menus->hasOrderableItem($restaurant),
            ],
        ];

        return [
            'checks' => $checks,
            'can_publish' => ! in_array(false, array_column($checks, 'complete'), true),
        ];
    }

    public function publish(Restaurant $restaurant, User $actor): array
    {
        return DB::transaction(function () use ($restaurant, $actor): array {
            $locked = $this->pages->lockRestaurant((int) $restaurant->getKey());
            $checklist = $this->publishChecklist($locked);
            if (! $checklist['can_publish']) {
                $errors = [];
                foreach ($checklist['checks'] as $key => $check) {
                    if (! $check['complete']) {
                        $errors[$key] = [$check['label'].'.'];
                    }
                }
                throw ValidationException::withMessages($errors);
            }
            $before = ['is_published' => (bool) $locked->is_published];
            $this->pages->updateRestaurant($locked, ['is_published' => true]);
            $this->record($actor, $locked, 'restaurant.published', 'restaurant', (string) $locked->getKey(), $before, ['is_published' => true]);

            return ['is_published' => true, 'checklist' => $checklist];
        });
    }

    public function unpublish(Restaurant $restaurant, User $actor): array
    {
        return DB::transaction(function () use ($restaurant, $actor): array {
            $locked = $this->pages->lockRestaurant((int) $restaurant->getKey());
            $before = ['is_published' => (bool) $locked->is_published];
            if ($locked->is_published) {
                $this->pages->updateRestaurant($locked, ['is_published' => false]);
                $this->record($actor, $locked, 'restaurant.unpublished', 'restaurant', (string) $locked->getKey(), $before, ['is_published' => false]);
            }

            return ['is_published' => false];
        });
    }

    public function setClosed(Restaurant $restaurant, User $actor, bool $closed, ?string $reason): array
    {
        return DB::transaction(function () use ($restaurant, $actor, $closed, $reason): array {
            $locked = $this->pages->lockRestaurant((int) $restaurant->getKey());
            if (! in_array($locked->status, ['approved', 'closed'], true)) {
                throw ValidationException::withMessages([
                    'status' => ['Only an approved or temporarily closed restaurant can change its closure state.'],
                ]);
            }
            $newStatus = $closed ? 'closed' : 'approved';
            $before = ['status' => $locked->status];
            if ($locked->status !== $newStatus) {
                $this->pages->updateRestaurant($locked, ['status' => $newStatus]);
                $this->record(
                    $actor,
                    $locked,
                    $closed ? 'restaurant.closed' : 'restaurant.reopened',
                    'restaurant',
                    (string) $locked->getKey(),
                    $before,
                    ['status' => $newStatus, 'reason' => $reason],
                );
            }

            return ['status' => $newStatus];
        });
    }

    public function deactivate(Restaurant $restaurant, User $actor): array
    {
        return DB::transaction(function () use ($restaurant, $actor): array {
            $locked = $this->pages->lockRestaurant((int) $restaurant->getKey());
            abort_unless((int) $locked->owner_user_id === (int) $actor->getKey(), 403);
            if ($locked->status === 'suspended') {
                throw ValidationException::withMessages([
                    'status' => ['A suspended restaurant can only be resolved by an administrator.'],
                ]);
            }

            if ($locked->status !== 'inactive') {
                $before = [
                    'status' => $locked->status,
                    'is_published' => (bool) $locked->is_published,
                ];
                $this->pages->updateRestaurant($locked, [
                    'status' => 'inactive',
                    'is_published' => false,
                ]);
                $this->record(
                    $actor,
                    $locked,
                    'restaurant.deactivated',
                    'restaurant',
                    (string) $locked->getKey(),
                    $before,
                    ['status' => 'inactive', 'is_published' => false],
                );
            }

            return ['status' => 'inactive', 'is_published' => false];
        });
    }

    public function reactivate(Restaurant $restaurant, User $actor): array
    {
        return DB::transaction(function () use ($restaurant, $actor): array {
            $locked = $this->pages->lockRestaurant((int) $restaurant->getKey());
            abort_unless((int) $locked->owner_user_id === (int) $actor->getKey(), 403);
            if ($locked->status !== 'inactive') {
                throw ValidationException::withMessages([
                    'status' => ['Only a restaurant deactivated by its Owner can be reactivated here.'],
                ]);
            }

            $before = [
                'status' => $locked->status,
                'is_published' => (bool) $locked->is_published,
            ];
            $this->pages->updateRestaurant($locked, [
                'status' => 'approved',
                'is_published' => false,
            ]);
            $this->record(
                $actor,
                $locked,
                'restaurant.reactivated',
                'restaurant',
                (string) $locked->getKey(),
                $before,
                ['status' => 'approved', 'is_published' => false],
            );

            return ['status' => 'approved', 'is_published' => false];
        });
    }

    private function pendingSensitiveUpdate(Restaurant $restaurant): ?array
    {
        $application = $this->applications->findPendingSensitiveUpdate((int) $restaurant->getKey());

        return $application === null ? null : $this->applications->toArray($application);
    }

    private function normalizeHours(array $hours): array
    {
        $rows = [];
        foreach (self::WEEKDAYS as $day => $weekday) {
            foreach (array_values($hours[$day] ?? []) as $index => $shift) {
                $rows[] = [
                    'weekday' => $weekday,
                    'open_time' => $shift['open_time'],
                    'close_time' => $shift['close_time'],
                    'crosses_midnight' => (bool) $shift['crosses_midnight'],
                    'shift_order' => $index + 1,
                ];
            }
        }

        return $rows;
    }

    private function validateHours(array $hours): void
    {
        $minutesByDay = array_fill(1, 7, 0);
        $intervalsByDay = array_fill(1, 7, []);
        foreach ($hours as $shift) {
            $start = $this->minutes((string) $shift['open_time']);
            $end = $this->minutes((string) $shift['close_time']);
            $weekday = (int) $shift['weekday'];
            if ($start === null || $end === null) {
                throw ValidationException::withMessages(['hours' => ['Choose valid operating hours.']]);
            }
            if ($shift['crosses_midnight']) {
                if ($end >= $start) {
                    throw ValidationException::withMessages(['hours' => ['An overnight shift must close earlier than it opens.']]);
                }
                $end += 1440;
            } elseif ($end <= $start) {
                throw ValidationException::withMessages(['hours' => ['Mark overnight shifts when closing after midnight.']]);
            }
            foreach ($intervalsByDay[$weekday] as [$otherStart, $otherEnd]) {
                if ($start < $otherEnd && $end > $otherStart) {
                    throw ValidationException::withMessages(['hours' => ['Operating shifts on the same day cannot overlap.']]);
                }
            }
            $intervalsByDay[$weekday][] = [$start, $end];
            $minutesByDay[$weekday] += $end - $start;
        }
        foreach ($intervalsByDay as $weekday => $intervals) {
            foreach ($intervals as [$start, $end]) {
                if ($end <= 1440) {
                    continue;
                }
                $nextWeekday = $weekday === 7 ? 1 : $weekday + 1;
                foreach ($intervalsByDay[$nextWeekday] as [$nextStart]) {
                    if ($nextStart < $end - 1440) {
                        throw ValidationException::withMessages(['hours' => ['Overnight shifts cannot overlap the next day.']]);
                    }
                }
            }
        }

        $openDays = 0;
        foreach ($minutesByDay as $minutes) {
            if ($minutes > 0) {
                $openDays++;
                if ($minutes < 240) {
                    throw ValidationException::withMessages(['hours' => ['Each open day must include at least four hours.']]);
                }
            }
        }
        if ($openDays < 5) {
            throw ValidationException::withMessages(['hours' => ['Add hours for at least five days per week, or select Open 24/7.']]);
        }
    }

    private function isOpenNow(Restaurant $restaurant): bool
    {
        $now = Carbon::now('Asia/Manila');
        if ($this->pages->closures($restaurant, $now->toDateString(), $now->toDateString())->isNotEmpty()) {
            return false;
        }
        if ($restaurant->is_24_7) {
            return true;
        }

        $currentMinute = ($now->hour * 60) + $now->minute;
        $today = $now->dayOfWeekIso;
        $previousDay = $today === 1 ? 7 : $today - 1;
        foreach ($this->pages->hours($restaurant) as $shift) {
            $start = $this->minutes((string) $shift->open_time);
            $end = $this->minutes((string) $shift->close_time);
            if ($start === null || $end === null) {
                continue;
            }
            if ((int) $shift->weekday === $today) {
                $todayEnd = $shift->crosses_midnight ? $end + 1440 : $end;
                if ($currentMinute >= $start && $currentMinute < $todayEnd) {
                    return true;
                }
            }
            if ((int) $shift->weekday === $previousDay
                && $shift->crosses_midnight
                && $currentMinute < $end) {
                return true;
            }
        }

        return false;
    }

    private function minutes(string $time): ?int
    {
        if (! preg_match('/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/', $time, $matches)) {
            return null;
        }

        return ((int) $matches[1] * 60) + (int) $matches[2];
    }

    private function photoArray(RestaurantPhoto $photo): array
    {
        $profile = $this->pages->profile($photo->restaurant);
        foreach ($profile['photos'] as $item) {
            if ($item['id'] === (string) $photo->getKey()) {
                return $item;
            }
        }

        return ['id' => (string) $photo->getKey(), 'path' => $photo->path];
    }

    private function parseCuisineNames(string $cuisines): array
    {
        return array_values(array_unique(array_filter(
            array_map('trim', explode(',', $cuisines)),
            static fn (string $name): bool => $name !== '',
        )));
    }

    private function closureArray(ClosureDate $closure): array
    {
        return [
            'id' => (string) $closure->getKey(),
            'closure_date' => $closure->closure_date?->toDateString(),
            'reason' => $closure->reason,
        ];
    }

    private function record(
        User $actor,
        Restaurant $restaurant,
        string $action,
        string $entityType,
        string $entityId,
        ?array $before,
        ?array $after,
    ): void {
        $this->audit->record([
            'actor_user_id' => $actor->getKey(),
            'restaurant_id' => $restaurant->getKey(),
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'before_value' => $before,
            'after_value' => $after,
            'created_at' => now(),
        ]);
    }
}
