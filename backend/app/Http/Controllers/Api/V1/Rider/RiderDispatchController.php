<?php

namespace App\Http\Controllers\Api\V1\Rider;

use App\Http\Controllers\Controller;
use App\Http\Requests\Rider\RiderAvailabilityRequest;
use App\Http\Requests\Rider\RiderLocationUpdateRequest;
use App\Models\RiderProfile;
use App\Models\User;
use App\Services\RiderDispatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RiderDispatchController extends Controller
{
    public function home(Request $request, RiderDispatchService $dispatch): JsonResponse
    {
        $profile = $this->profile($request);
        $this->authorize('accessDispatch', $profile);

        return response()->json(['data' => $dispatch->home($request->user())]);
    }

    public function setAvailability(
        RiderAvailabilityRequest $request,
        RiderDispatchService $dispatch,
    ): JsonResponse {
        $profile = $this->profile($request);
        $this->authorize('accessDispatch', $profile);
        $data = $request->validated();

        return response()->json(['data' => $dispatch->setAvailability(
            $request->user(),
            $data['availability'],
            isset($data['latitude']) ? (float) $data['latitude'] : null,
            isset($data['longitude']) ? (float) $data['longitude'] : null,
        )]);
    }

    public function current(Request $request, RiderDispatchService $dispatch): JsonResponse
    {
        $profile = $this->profile($request);
        $this->authorize('accessDispatch', $profile);

        return response()->json(['data' => $dispatch->currentFor($request->user())]);
    }

    public function updateLocation(
        RiderLocationUpdateRequest $request,
        RiderDispatchService $dispatch,
        string $delivery,
    ): JsonResponse {
        $profile = $this->profile($request);
        $this->authorize('accessDispatch', $profile);
        $data = $request->validated();

        return response()->json(['data' => $dispatch->updateDeliveryLocation(
            $request->user(),
            (int) $delivery,
            (float) $data['latitude'],
            (float) $data['longitude'],
        )]);
    }

    public function clearLocation(
        Request $request,
        RiderDispatchService $dispatch,
        string $delivery,
    ): JsonResponse {
        $profile = $this->profile($request);
        $this->authorize('accessDispatch', $profile);
        $dispatch->clearDeliveryLocation($request->user(), (int) $delivery);

        return response()->json(['data' => ['cleared' => true]]);
    }

    public function accept(Request $request, RiderDispatchService $dispatch, string $offer): JsonResponse
    {
        $profile = $this->profile($request);
        $this->authorize('accessDispatch', $profile);

        return response()->json(['data' => $dispatch->respondToOffer(
            $request->user(),
            (int) $offer,
            true,
        )]);
    }

    public function decline(Request $request, RiderDispatchService $dispatch, string $offer): JsonResponse
    {
        $profile = $this->profile($request);
        $this->authorize('accessDispatch', $profile);

        return response()->json(['data' => $dispatch->respondToOffer(
            $request->user(),
            (int) $offer,
            false,
        )]);
    }

    private function profile(Request $request): RiderProfile
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user->riderProfile()->firstOrFail();
    }
}
