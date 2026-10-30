<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ApplicationDocumentAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ApplicationDocumentController extends Controller
{
    public function temporaryUrl(Request $request, int $document, ApplicationDocumentAccessService $service): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return JsonResource::make([
            'url' => $service->createTemporaryUrl($user, $document),
            'expires_in_seconds' => 300,
        ])->response();
    }

    public function download(Request $request, int $document, ApplicationDocumentAccessService $service): StreamedResponse
    {
        /** @var User $user */
        $user = $request->user();

        return $service->download($user, $document);
    }
}
