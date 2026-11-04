<?php

namespace App\Services;

use App\Models\Delivery;
use App\Models\AuditLog;
use App\Models\RiderProfile;
use App\Models\User;
use App\Repositories\Contracts\RiderApplicationRepository;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\StreamedResponse;

class RiderAdminService
{
    public function __construct(
        private readonly RiderApplicationRepository $riders,
        private readonly RiderSchedulingService $scheduling,
    ) {}

    public function list(array $params): array
    {
        $query = $this->approvedProfiles()
            ->select('rider_profiles.*')
            ->join('users', 'users.id', '=', 'rider_profiles.user_id')
            ->with('user');
        $this->withDirectoryMetrics($query);

        if (isset($params['status']) && $params['status'] !== '') {
            $query->where('rider_profiles.status', $params['status']);
        }

        if (! empty($params['search'])) {
            $search = '%'.addcslashes(trim((string) $params['search']), '\\%_').'%';
            $query->where(function (Builder $profiles) use ($search): void {
                $profiles->whereHas('user', function (Builder $users) use ($search): void {
                    $users->where(function (Builder $identity) use ($search): void {
                        $identity->whereRaw("CONCAT_WS(' ', first_name, middle_name, last_name, suffix) LIKE ?", [$search])
                            ->orWhere('first_name', 'like', $search)
                            ->orWhere('middle_name', 'like', $search)
                            ->orWhere('last_name', 'like', $search)
                            ->orWhere('email', 'like', $search)
                            ->orWhere('mobile', 'like', $search);
                    });
                });
            });
        }

        $direction = ($params['direction'] ?? 'desc') === 'asc' ? 'asc' : 'desc';
        $sort = $params['sort'] ?? 'created_at';
        if ($sort === 'name') {
            $query->orderBy('users.first_name', $direction)->orderBy('users.last_name', $direction);
        } else {
            $sortColumn = match ($sort) {
                'email' => 'users.email',
                'status' => 'rider_profiles.status',
                'vehicle_type' => 'rider_profiles.vehicle_type',
                'approved_at' => 'rider_profiles.approved_at',
                'earnings.total' => 'earnings_total',
                'earnings.deliveries_count' => 'deliveries_count',
                default => 'rider_profiles.created_at',
            };
            $query->orderBy($sortColumn, $direction);
        }
        $query->orderBy('rider_profiles.id');

        $perPage = min(100, max(1, (int) ($params['per_page'] ?? 15)));
        $page = max(1, (int) ($params['page'] ?? 1));
        $paginator = $query->paginate($perPage, ['rider_profiles.*'], 'page', $page);

        return [
            'data' => $paginator->getCollection()->map(fn (RiderProfile $profile): array => $this->directoryRecord($profile))->all(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ];
    }

    public function find(string $id): array
    {
        $query = $this->profileQuery()
            ->with([
                'user',
                'location.parent.parent.parent',
                'documents',
                'preferredShifts',
                'shiftAssignments.zone',
                'shiftAssignments.shift',
            ])
            ->where('application_status', 'approved');
        $this->withDirectoryMetrics($query);
        $profile = $query->findOrFail($id);

        return array_replace(
            $this->directoryRecord($profile),
            \App\Http\Resources\RiderProfileResource::make($profile)->resolve(request()),
        );
    }

    public function changeStatus(int $riderId, string $status, User $admin): array
    {
        $profile = $this->scheduling->changeRiderStatus($riderId, $status, $admin);

        return $this->find((string) $profile->getKey());
    }

    public function proofs(string $riderId, array $params): array
    {
        $profile = $this->approvedProfiles()->findOrFail($riderId);
        $query = Delivery::query()
            ->with('order')
            ->where('rider_id', $profile->getKey())
            ->where('status', 'delivered')
            ->whereNotNull('proof_photo_path');

        if (! empty($params['search'])) {
            $search = '%'.addcslashes(trim((string) $params['search']), '\\%_').'%';
            $query->whereHas('order', fn (Builder $orders) => $orders->where('reference_code', 'like', $search));
        }

        $direction = ($params['direction'] ?? 'desc') === 'asc' ? 'asc' : 'desc';
        $query->orderBy(($params['sort'] ?? null) === 'order_number' ? 'id' : 'delivered_at', $direction)
            ->orderBy('id');
        $perPage = min(100, max(1, (int) ($params['per_page'] ?? 15)));
        $paginator = $query->paginate($perPage, ['*'], 'page', max(1, (int) ($params['page'] ?? 1)));

        return [
            'data' => $paginator->getCollection()->map(fn (Delivery $delivery): array => [
                'id' => (string) $delivery->getKey(),
                'delivery_id' => (string) $delivery->getKey(),
                'order_number' => $delivery->order?->reference_code,
                'stage' => 'dropoff',
                'latitude' => $delivery->proof_lat === null ? null : (float) $delivery->proof_lat,
                'longitude' => $delivery->proof_lng === null ? null : (float) $delivery->proof_lng,
                'taken_at' => $delivery->delivered_at?->toISOString(),
            ])->all(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ];
    }

    public function createProofDownloadUrl(int $riderId, int $deliveryId): string
    {
        $delivery = Delivery::query()
            ->where('rider_id', $riderId)
            ->whereKey($deliveryId)
            ->whereNotNull('proof_photo_path')
            ->firstOrFail();
        $this->assertSafeProofPath((string) $delivery->proof_photo_path, $riderId);
        abort_unless(Storage::disk('private')->exists($delivery->proof_photo_path), 404);

        return URL::temporarySignedRoute(
            'api.v1.private-delivery-proofs.download',
            now()->addMinutes(5),
            ['delivery' => $delivery->getKey()],
        );
    }

    public function streamProof(int $deliveryId): StreamedResponse
    {
        $delivery = Delivery::query()->whereKey($deliveryId)->whereNotNull('proof_photo_path')->firstOrFail();
        $path = (string) $delivery->proof_photo_path;
        $this->assertSafeProofPath($path, (int) $delivery->rider_id);
        $disk = Storage::disk('private');
        abort_unless($disk->exists($path), 404);
        $mime = $disk->mimeType($path);
        abort_unless(in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true), 404);
        $stream = $disk->readStream($path);
        if (! is_resource($stream)) {
            throw new \RuntimeException('The private rider delivery proof could not be opened.');
        }

        return response()->stream(function () use ($stream): void {
            fpassthru($stream);
            fclose($stream);
        }, 200, [
            'Content-Type' => $mime,
            'Content-Disposition' => 'inline; filename="delivery-proof.'.match ($mime) {
                'image/png' => 'png',
                'image/webp' => 'webp',
                default => 'jpg',
            }.'"',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    private function approvedProfiles(): Builder
    {
        return $this->profileQuery()->where('application_status', 'approved');
    }

    private function profileQuery(): Builder
    {
        return $this->riders->profiles();
    }

    private function withDirectoryMetrics(Builder $query): Builder
    {
        return $query
            ->withSum(['deliveries as earnings_total' => fn (Builder $deliveries) => $deliveries->where('status', 'delivered')], 'rider_earning')
            ->withSum(['deliveries as earnings_this_week' => fn (Builder $deliveries) => $deliveries
                ->where('status', 'delivered')
                ->where('delivered_at', '>=', now()->startOfWeek())], 'rider_earning')
            ->withCount(['deliveries as deliveries_count' => fn (Builder $deliveries) => $deliveries->where('status', 'delivered')])
            ->addSelect([
                'activated_at' => AuditLog::query()
                    ->select('created_at')
                    ->where('action', 'rider_activation_verified')
                    ->where('entity_type', 'rider_profile')
                    ->whereColumn('entity_id', 'rider_profiles.id')
                    ->latest('id')
                    ->limit(1),
            ]);
    }

    private function directoryRecord(RiderProfile $profile): array
    {
        $profile->loadMissing('user');

        return [
            'id' => (string) $profile->getKey(),
            'name' => $profile->user->name,
            'email' => $profile->user->email,
            'phone' => $profile->user->mobile,
            'status' => $profile->status,
            'application_status' => $profile->application_status,
            'vehicle_type' => $profile->vehicle_type,
            'plate_no' => $profile->plate_number,
            'is_online' => $profile->status === 'active' && $profile->availability === 'online',
            'last_position' => null,
            'earnings' => [
                'total' => (float) ($profile->earnings_total ?? 0),
                'this_week' => (float) ($profile->earnings_this_week ?? 0),
                'deliveries_count' => (int) ($profile->deliveries_count ?? 0),
            ],
            'activated_at' => $profile->activated_at === null
                ? null
                : Carbon::parse($profile->activated_at)->toISOString(),
            'resigned_at' => $profile->resigned_at?->toISOString(),
            'created_at' => $profile->created_at?->toISOString(),
        ];
    }

    private function assertSafeProofPath(string $path, int $riderId): void
    {
        abort_unless(preg_match(
            '/\Ariders\/'.preg_quote((string) $riderId, '/').'\/proofs\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)\z/i',
            $path,
        ) === 1, 404);
    }
}
