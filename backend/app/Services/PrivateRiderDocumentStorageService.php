<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PrivateRiderDocumentStorageService
{
    private const MAX_BYTES = 2 * 1024 * 1024;

    public function store(UploadedFile $file, int $riderId, string $docType): string
    {
        $realPath = $file->getRealPath();
        $size = $file->getSize();
        if (! is_string($realPath) || ! is_file($realPath) || ! is_int($size) || $size > self::MAX_BYTES) {
            throw ValidationException::withMessages(['file' => ['Files must be no larger than 2 MB.']]);
        }

        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($realPath);
        $isDocument = in_array($docType, ['drivers_license', 'or_cr'], true);
        if ($mime === 'application/pdf' && $isDocument) {
            if (strtolower($file->getClientOriginalExtension()) !== 'pdf') {
                throw ValidationException::withMessages(['file' => ['The file extension does not match the document type.']]);
            }
            $contents = file_get_contents($realPath);
            if (! is_string($contents) || ! str_starts_with($contents, '%PDF-')) {
                throw ValidationException::withMessages(['file' => ['The PDF file is invalid.']]);
            }

            return $this->persist($riderId, $docType, 'pdf', $contents);
        }

        if (! in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
            throw ValidationException::withMessages(['file' => ['Upload a JPG, PNG, WebP image'.($isDocument ? ' or PDF' : '').'.']]);
        }
        $allowedExtensions = match ($mime) {
            'image/jpeg' => ['jpg', 'jpeg'],
            'image/png' => ['png'],
            'image/webp' => ['webp'],
        };
        if (! in_array(strtolower($file->getClientOriginalExtension()), $allowedExtensions, true)) {
            throw ValidationException::withMessages(['file' => ['The file extension does not match its image type.']]);
        }
        if (! extension_loaded('gd')) {
            throw new \RuntimeException('The GD extension is required to process rider images.');
        }

        $source = file_get_contents($realPath);
        $dimensions = is_string($source) ? @getimagesizefromstring($source) : false;
        $image = is_string($source) ? @imagecreatefromstring($source) : false;
        if ($image === false || $dimensions === false
            || $dimensions[0] < 1 || $dimensions[1] < 1
            || $dimensions[0] > 12000 || $dimensions[1] > 12000
            || $dimensions[0] * $dimensions[1] > 12_000_000) {
            throw ValidationException::withMessages(['file' => ['The uploaded file is not a valid image.']]);
        }

        $width = imagesx($image);
        $height = imagesy($image);
        $normalized = imagecreatetruecolor($width, $height);
        $background = imagecolorallocate($normalized, 255, 255, 255);
        imagefill($normalized, 0, 0, $background);
        imagecopy($normalized, $image, 0, 0, 0, 0, $width, $height);
        imagedestroy($image);

        $encoded = '';
        for ($quality = 85; $quality >= 55; $quality -= 10) {
            ob_start();
            imagejpeg($normalized, null, $quality);
            $candidate = ob_get_clean();
            if (is_string($candidate) && strlen($candidate) <= self::MAX_BYTES) {
                $encoded = $candidate;
                break;
            }
        }
        imagedestroy($normalized);

        if ($encoded === '' || (new \finfo(FILEINFO_MIME_TYPE))->buffer($encoded) !== 'image/jpeg') {
            throw ValidationException::withMessages(['file' => ['The image could not be safely processed within 2 MB.']]);
        }

        return $this->persist($riderId, $docType, 'jpg', $encoded);
    }

    public function delete(string $path, int $riderId, string $docType): void
    {
        abort_unless($this->isSafePath($path, $riderId, $docType), 404);
        $disk = Storage::disk('private');
        if ($disk->exists($path) && ! $disk->delete($path)) {
            throw new \RuntimeException('A replaced rider document could not be deleted from private storage.');
        }
    }

    public function isSafePath(string $path, int $riderId, ?string $docType = null): bool
    {
        if ($docType !== null && ! in_array($docType, ['profile_photo', 'id_photo', 'drivers_license', 'or_cr'], true)) {
            return false;
        }

        $types = $docType === null
            ? '(profile_photo|id_photo|drivers_license|or_cr)'
            : preg_quote($docType, '/');

        return preg_match(
            '/\Ariders\/'.preg_quote((string) $riderId, '/').'\/documents\/'.$types.'-[A-Za-z0-9]{40}\.(?:jpg|pdf)\z/',
            $path,
        ) === 1;
    }

    private function persist(int $riderId, string $docType, string $extension, string $contents): string
    {
        $path = "riders/{$riderId}/documents/{$docType}-".Str::random(40).".{$extension}";
        if (! Storage::disk('private')->put($path, $contents)) {
            throw new \RuntimeException('The rider document could not be stored on the private disk.');
        }

        return $path;
    }
}
