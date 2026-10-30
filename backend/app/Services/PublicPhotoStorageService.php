<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PublicPhotoStorageService
{
    private const MIME_EXTENSIONS = [
        'image/jpeg' => ['jpg', IMAGETYPE_JPEG],
        'image/png' => ['png', IMAGETYPE_PNG],
        'image/webp' => ['webp', IMAGETYPE_WEBP],
    ];

    public function store(UploadedFile $file): string
    {
        if (($file->getSize() ?? 0) > 2 * 1024 * 1024) {
            throw ValidationException::withMessages(['file' => ['Photos may not exceed 2 MB.']]);
        }

        $source = file_get_contents($file->getRealPath());
        if (! is_string($source)) {
            throw new \RuntimeException('The uploaded photo could not be read.');
        }

        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($source);
        $format = is_string($mime) ? (self::MIME_EXTENSIONS[$mime] ?? null) : null;
        $image = getimagesizefromstring($source);
        if ($format === null || $image === false || $image[2] !== $format[1]) {
            throw ValidationException::withMessages(['file' => ['Upload a real JPG, PNG, or WebP image.']]);
        }

        $clean = match ($mime) {
            'image/jpeg' => $this->stripJpegMetadata($source),
            'image/png' => $this->stripPngExif($source),
            'image/webp' => $this->stripWebpExif($source),
        };
        $path = 'restaurant-photos/'.Str::uuid().'.'.$format[0];
        if (! Storage::disk('public')->put($path, $clean)) {
            throw new \RuntimeException('The public photo could not be stored.');
        }

        return $path;
    }

    private function stripJpegMetadata(string $image): string
    {
        if (substr($image, 0, 2) !== "\xFF\xD8") {
            throw ValidationException::withMessages(['file' => ['The JPG image is malformed.']]);
        }

        $result = substr($image, 0, 2);
        $offset = 2;
        $length = strlen($image);
        while ($offset < $length) {
            $start = $offset;
            if (ord($image[$offset]) !== 0xFF) {
                throw ValidationException::withMessages(['file' => ['The JPG image is malformed.']]);
            }
            while ($offset < $length && ord($image[$offset]) === 0xFF) {
                $offset++;
            }
            if ($offset >= $length) {
                throw ValidationException::withMessages(['file' => ['The JPG image is malformed.']]);
            }

            $marker = ord($image[$offset++]);
            if ($marker === 0xDA || $marker === 0xD9) {
                return $result.substr($image, $start);
            }
            if ($marker === 0x01 || ($marker >= 0xD0 && $marker <= 0xD7)) {
                $result .= substr($image, $start, $offset - $start);
                continue;
            }
            if ($offset + 2 > $length) {
                throw ValidationException::withMessages(['file' => ['The JPG image is malformed.']]);
            }

            $segmentLength = unpack('n', substr($image, $offset, 2))[1];
            $segmentEnd = $offset + $segmentLength;
            if ($segmentLength < 2 || $segmentEnd > $length) {
                throw ValidationException::withMessages(['file' => ['The JPG image is malformed.']]);
            }

            $isExif = $marker === 0xE1 && substr($image, $offset + 2, 6) === "Exif\0\0";
            if (! $isExif) {
                $result .= substr($image, $start, $segmentEnd - $start);
            }
            $offset = $segmentEnd;
        }

        throw ValidationException::withMessages(['file' => ['The JPG image is malformed.']]);
    }

    private function stripPngExif(string $image): string
    {
        if (substr($image, 0, 8) !== "\x89PNG\r\n\x1A\n") {
            throw ValidationException::withMessages(['file' => ['The PNG image is malformed.']]);
        }

        $result = substr($image, 0, 8);
        $offset = 8;
        $length = strlen($image);
        while ($offset + 12 <= $length) {
            $chunkLength = unpack('N', substr($image, $offset, 4))[1];
            $chunkEnd = $offset + 12 + $chunkLength;
            if ($chunkEnd > $length) {
                throw ValidationException::withMessages(['file' => ['The PNG image is malformed.']]);
            }
            $type = substr($image, $offset + 4, 4);
            if ($type !== 'eXIf') {
                $result .= substr($image, $offset, $chunkEnd - $offset);
            }
            $offset = $chunkEnd;
            if ($type === 'IEND') {
                return $result;
            }
        }

        throw ValidationException::withMessages(['file' => ['The PNG image is malformed.']]);
    }

    private function stripWebpExif(string $image): string
    {
        if (substr($image, 0, 4) !== 'RIFF' || substr($image, 8, 4) !== 'WEBP') {
            throw ValidationException::withMessages(['file' => ['The WebP image is malformed.']]);
        }

        $chunks = '';
        $offset = 12;
        $length = strlen($image);
        while ($offset + 8 <= $length) {
            $chunkStart = $offset;
            $chunkType = substr($image, $offset, 4);
            $chunkLength = unpack('V', substr($image, $offset + 4, 4))[1];
            $chunkEnd = $offset + 8 + $chunkLength + ($chunkLength % 2);
            if ($chunkEnd > $length) {
                throw ValidationException::withMessages(['file' => ['The WebP image is malformed.']]);
            }
            if ($chunkType !== 'EXIF') {
                $chunks .= substr($image, $chunkStart, $chunkEnd - $chunkStart);
            }
            $offset = $chunkEnd;
        }
        if ($offset !== $length) {
            throw ValidationException::withMessages(['file' => ['The WebP image is malformed.']]);
        }

        return 'RIFF'.pack('V', strlen($chunks) + 4).'WEBP'.$chunks;
    }
}
