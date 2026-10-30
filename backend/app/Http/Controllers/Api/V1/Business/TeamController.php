<?php

namespace App\Http\Controllers\Api\V1\Business;

use App\Http\Controllers\Controller;
use App\Http\Requests\Business\OwnershipTransferRequest;
use App\Http\Requests\Business\TeamEmailCheckRequest;
use App\Http\Requests\Business\TeamActionRequest;
use App\Http\Requests\Business\TeamInvitationRequest;
use App\Http\Requests\Business\TeamListRequest;
use App\Http\Requests\Business\TeamMemberUpdateRequest;
use App\Http\Resources\TeamResource;
use App\Models\Restaurant;
use App\Models\User;
use App\Services\TeamService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TeamController extends Controller
{
    public function index(TeamListRequest $request, TeamService $service): TeamResource
    {
        return TeamResource::make($service->list($this->restaurant($request), $this->actor($request), $request->validated()));
    }

    public function checkEmail(TeamEmailCheckRequest $request, TeamService $service): TeamResource
    {
        return TeamResource::make($service->checkEmail(
            $this->restaurant($request),
            $this->actor($request),
            $request->validated('email'),
        ));
    }

    public function invite(TeamInvitationRequest $request, TeamService $service): TeamResource
    {
        return TeamResource::make($service->invite(
            $this->restaurant($request),
            $this->actor($request),
            $request->validated(),
        ));
    }

    public function resend(TeamActionRequest $request, TeamService $service): TeamResource
    {
        return TeamResource::make($service->resend(
            $this->restaurant($request),
            $this->actor($request),
            (int) $request->route('invitation'),
        ));
    }

    public function cancel(TeamActionRequest $request, TeamService $service): JsonResponse
    {
        $service->cancel(
            $this->restaurant($request),
            $this->actor($request),
            (int) $request->route('invitation'),
        );

        return response()->json([], 204);
    }

    public function updateMember(TeamMemberUpdateRequest $request, TeamService $service): TeamResource
    {
        return TeamResource::make($service->updateMember(
            $this->restaurant($request),
            $this->actor($request),
            (int) $request->route('membership'),
            $request->validated(),
        ));
    }

    public function removeMember(TeamActionRequest $request, TeamService $service): JsonResponse
    {
        $service->removeMember(
            $this->restaurant($request),
            $this->actor($request),
            (int) $request->route('membership'),
        );

        return response()->json([], 204);
    }

    public function transferOwnership(OwnershipTransferRequest $request, TeamService $service): TeamResource
    {
        return TeamResource::make($service->transferOwnership(
            $this->restaurant($request),
            $this->actor($request),
            (int) $request->validated('manager_id'),
            $request->validated('password'),
        ));
    }

    private function restaurant(Request $request): Restaurant
    {
        $restaurant = $request->attributes->get('restaurant');
        abort_unless($restaurant instanceof Restaurant, 404);

        return $restaurant;
    }

    private function actor(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
