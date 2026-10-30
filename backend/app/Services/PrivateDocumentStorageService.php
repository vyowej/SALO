<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PrivateDocumentStorageService
{
    private const ALLOWED_MIME_TYPES = [
        'application/pdf' => 'pdf',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    public function store(UploadedFile $file): string
    {
        if (($file->getSize() ?? 0) > 2 * 1024 * 1024) {
            throw ValidationException::withMessages(['file' => ['Documents may not exceed 2 MB.']]);
        }

        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file->getRealPath());
        if (! is_string($mime) || ! isset(self::ALLOWED_MIME_TYPES[$mime])) {
            throw ValidationException::withMessages(['file' => ['Upload a PDF, JPG, PNG, or WebP document.']]);
        }

        $path = 'application-documents/'.Str::uuid().'.'.self::ALLOWED_MIME_TYPES[$mime];
        $storedPath = $file->storeAs('application-documents', basename($path), 'private');
        if ($storedPath === false) {
            throw new \RuntimeException('The private document could not be stored.');
        }

        return $storedPath;
    }
}
