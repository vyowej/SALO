<?php

namespace App\Http\Controllers\Api\V1\Applications;

use App\Http\Controllers\Controller;
use App\Http\Requests\Applications\BusinessEmailOtpRequest;
use App\Http\Requests\Applications\RestaurantApplicationDraftRequest;
use App\Http\Requests\Applications\SubmitRestaurantApplicationRequest;
use App\Http\Requests\Applications\UploadApplicationDocumentRequest;
use App\Http\Requests\Applications\UploadApplicationPhotoRequest;
use App\Http\Resources\RestaurantApplicationResource;
use App\Models\RestaurantApplication;
use App\Models\User;
use App\Services\RestaurantApplicationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RestaurantApplicationController extends Controller
{
    public function store(Request $request, RestaurantApplicationService $service): RestaurantApplicationResource
    {
        $user = $this->user($request);
        $this->authorize('create', RestaurantApplication::class);

        return RestaurantApplicationResource::make($service->getOrCreate($user));
    }

    public function mine(Request $request, RestaurantApplicationService $service): RestaurantApplicationResource
    {
        $user = $this->user($request);
        $this->authorize('create', RestaurantApplication::class);

        return RestaurantApplicationResource::make($service->getOrCreate($user));
    }

    public function show(Request $request, int $application, RestaurantApplicationService $service): RestaurantApplicationResource
    {
        $record = $service->findForApplicant($this->user($request), $application);
        $this->authorize('view', $record);

        return RestaurantApplicationResource::make($record);
    }

    public function update(
        RestaurantApplicationDraftRequest $request,
        int $application,
        RestaurantApplicationService $service,
    ): RestaurantApplicationResource {
        $user = $this->user($request);
        $current = $service->findForApplicant($user, $application);
        $this->authorize('update', $current);
        $record = $service->update(
            $user,
            $application,
            $request->validated('draft_details'),
        );

        return RestaurantApplicationResource::make($record);
    }

    public function sendBusinessEmailOtp(
        Request $request,
        int $application,
        RestaurantApplicationService $service,
    ): JsonResponse {
        $user = $this->user($request);
        $record = $service->findForApplicant($user, $application);
        $this->authorize('update', $record);
        $service->sendBusinessEmailOtp($user, $application);

        return response()->json(['data' => ['message' => 'If the address is valid, a verification code has been sent.']]);
    }

    public function verifyBusinessEmail(
        BusinessEmailOtpRequest $request,
        int $application,
        RestaurantApplicationService $service,
    ): RestaurantApplicationResource {
        $user = $this->user($request);
        $current = $service->findForApplicant($user, $application);
        $this->authorize('update', $current);
        $record = $service->verifyBusinessEmail(
            $user,
            $application,
            $request->validated('code'),
        );

        return RestaurantApplicationResource::make($record);
    }

    public function uploadDocument(
        UploadApplicationDocumentRequest $request,
        int $application,
        RestaurantApplicationService $service,
    ): RestaurantApplicationResource {
        $user = $this->user($request);
        $current = $service->findForApplicant($user, $application);
        $this->authorize('update', $current);
        $service->uploadDocument(
            $user,
            $application,
            $request->validated('doc_type'),
            $request->file('file'),
            $request->validated('expiry_date'),
        );

        return RestaurantApplicationResource::make($service->findForApplicant($user, $application));
    }

    public function deleteDocument(
        Request $request,
        int $application,
        int $document,
        RestaurantApplicationService $service,
    ): JsonResponse {
        $user = $this->user($request);
        $current = $service->findForApplicant($user, $application);
        $this->authorize('update', $current);
        $service->deleteDocument($user, $application, $document);

        return response()->json([], 204);
    }

    public function uploadPhoto(
        UploadApplicationPhotoRequest $request,
        int $application,
        RestaurantApplicationService $service,
    ): RestaurantApplicationResource {
        $user = $this->user($request);
        $current = $service->findForApplicant($user, $application);
        $this->authorize('update', $current);
        $record = $service->uploadPhoto(
            $user,
            $application,
            $request->validated('kind'),
            $request->file('file'),
        );

        return RestaurantApplicationResource::make($record);
    }

    public function submit(
        SubmitRestaurantApplicationRequest $request,
        int $application,
        RestaurantApplicationService $service,
    ): RestaurantApplicationResource {
        $user = $this->user($request);
        $current = $service->findForApplicant($user, $application);
        $this->authorize('submit', $current);
        $record = $service->submit(
            $user,
            $application,
            (bool) $request->validated('declared_bir_2303'),
        );

        return RestaurantApplicationResource::make($record);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
