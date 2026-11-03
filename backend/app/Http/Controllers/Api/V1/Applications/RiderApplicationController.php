<?php

namespace App\Http\Controllers\Api\V1\Applications;

use App\Http\Controllers\Controller;
use App\Http\Requests\Applications\RiderActivationRequest;
use App\Http\Requests\Applications\RiderApplicationDraftRequest;
use App\Http\Requests\Applications\RiderDocumentUploadRequest;
use App\Http\Requests\Applications\RiderSubmitRequest;
use App\Http\Resources\RiderProfileResource;
use App\Models\RiderProfile;
use App\Models\User;
use App\Services\RiderApplicationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RiderApplicationController extends Controller
{
    public function store(Request $request, RiderApplicationService $service): JsonResponse
    {
        $user = $this->user($request);
        $this->authorize('create', RiderProfile::class);
        $existed = $service->hasProfile($user);
        $profile = $service->getOrCreate($user);

        return RiderProfileResource::make($profile)
            ->response()
            ->setStatusCode($existed ? 200 : 201);
    }

    public function mine(Request $request, RiderApplicationService $service): RiderProfileResource
    {
        $profile = $service->findForUser($this->user($request));
        $this->authorize('view', $profile);

        return RiderProfileResource::make($service->findForApplicant($this->user($request), (int) $profile->getKey()));
    }

    public function show(Request $request, int $rider, RiderApplicationService $service): RiderProfileResource
    {
        $profile = $service->findForApplicant($this->user($request), $rider);
        $this->authorize('view', $profile);

        return RiderProfileResource::make($profile);
    }

    public function update(
        RiderApplicationDraftRequest $request,
        int $rider,
        RiderApplicationService $service,
    ): RiderProfileResource {
        $user = $this->user($request);
        $profile = $service->findForApplicant($user, $rider);
        $this->authorize('update', $profile);

        return RiderProfileResource::make($service->updateDraft($user, $rider, $request->validated()));
    }

    public function uploadDocument(
        RiderDocumentUploadRequest $request,
        int $rider,
        RiderApplicationService $service,
    ): RiderProfileResource {
        $user = $this->user($request);
        $profile = $service->findForApplicant($user, $rider);
        $this->authorize('update', $profile);

        return RiderProfileResource::make($service->uploadDocument(
            $user,
            $rider,
            $request->validated('doc_type'),
            $request->file('file'),
        ));
    }

    public function deleteDocument(Request $request, int $rider, int $document, RiderApplicationService $service): JsonResponse
    {
        $user = $this->user($request);
        $profile = $service->findForApplicant($user, $rider);
        $this->authorize('update', $profile);
        $service->deleteDocument($user, $rider, $document);

        return response()->json([], 204);
    }

    public function documentUrl(Request $request, int $rider, int $document, RiderApplicationService $service): JsonResponse
    {
        $user = $this->user($request);
        $url = $service->createDocumentDownloadUrl($user, $rider, $document);

        return response()->json(['data' => ['url' => $url, 'expires_in_seconds' => 300]]);
    }

    public function download(Request $request, int $document, RiderApplicationService $service): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        return $service->streamDocument($this->user($request), $document);
    }

    public function submit(
        RiderSubmitRequest $request,
        int $rider,
        RiderApplicationService $service,
    ): RiderProfileResource {
        $user = $this->user($request);
        $profile = $service->findForApplicant($user, $rider);
        $this->authorize('submit', $profile);

        return RiderProfileResource::make($service->submit($user, $rider));
    }

    public function sendActivationOtp(Request $request, int $rider, RiderApplicationService $service): JsonResponse
    {
        $user = $this->user($request);
        $profile = $service->findForApplicant($user, $rider);
        $this->authorize('activate', $profile);
        $delivery = $service->sendActivationCode($profile);

        return response()->json(['data' => $delivery]);
    }

    public function verifyActivation(
        RiderActivationRequest $request,
        int $rider,
        RiderApplicationService $service,
    ): RiderProfileResource {
        $user = $this->user($request);
        $profile = $service->findForApplicant($user, $rider);
        $this->authorize('activate', $profile);

        return RiderProfileResource::make($service->verifyActivation($user, $profile, $request->validated('code')));
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
