<?php

namespace App\Console\Commands;

use App\Models\RiderDocument;
use App\Repositories\Contracts\PlatformSettingsRepository;
use App\Repositories\Contracts\RiderApplicationRepository;
use App\Services\PrivateRiderDocumentStorageService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class PruneRiderDocuments extends Command
{
    protected $signature = 'salo:prune-rider-documents';

    protected $description = 'Delete expired rejected-rider documents and old orphaned rider files';

    public function handle(
        PrivateRiderDocumentStorageService $privateFiles,
        PlatformSettingsRepository $settings,
        RiderApplicationRepository $riders,
    ): int {
        $retentionDays = $this->retentionDays($settings);
        $cutoff = now()->subDays($retentionDays);
        $expired = $riders->documents()
            ->whereHas('rider', fn ($query) => $query
                ->where('application_status', 'rejected')
                ->where('updated_at', '<=', $cutoff))
            ->get();
        $toDelete = $expired->map(fn (RiderDocument $document): array => [
            'id' => $document->getKey(),
            'rider_id' => (int) $document->rider_id,
            'doc_type' => $document->doc_type,
            'path' => $document->private_path,
        ])->all();

        DB::transaction(function () use ($toDelete, $riders): void {
            $riders->documents()->whereIn('id', array_column($toDelete, 'id'))->delete();
        });
        foreach ($toDelete as $document) {
            $privateFiles->delete($document['path'], $document['rider_id'], $document['doc_type']);
        }

        $disk = Storage::disk('private');
        $orphanCutoff = now()->subDay()->getTimestamp();
        $orphanCount = 0;
        foreach ($disk->allFiles('riders') as $path) {
            if ($disk->lastModified($path) >= $orphanCutoff
                || $riders->documents()->where('private_path', $path)->exists()) {
                continue;
            }
            if (! preg_match('/\Ariders\/\d+\/documents\/(?:profile_photo|id_photo|drivers_license|or_cr)-[A-Za-z0-9]{40}\.(?:jpg|pdf)\z/', $path)) {
                continue;
            }
            if (! $disk->delete($path)) {
                throw new \RuntimeException('An orphaned rider document could not be removed from private storage.');
            }
            $orphanCount++;
        }

        $this->info('Removed '.count($toDelete).' expired rider documents and '.$orphanCount.' orphaned files.');

        return self::SUCCESS;
    }

    private function retentionDays(PlatformSettingsRepository $settings): int
    {
        $value = $settings->all()['rejected_doc_retention_days'] ?? null;

        return is_numeric($value) ? min(3650, max(1, (int) $value)) : 30;
    }
}
