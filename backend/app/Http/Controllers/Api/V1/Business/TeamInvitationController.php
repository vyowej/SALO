<?php

namespace App\Http\Controllers\Api\V1\Business;

use App\Http\Controllers\Controller;
use App\Http\Requests\Business\AcceptTeamInvitationRequest;
use App\Http\Requests\Business\ActivateTeamInvitationRequest;
use App\Http\Resources\TeamResource;
use App\Models\User;
use App\Services\TeamService;

class TeamInvitationController extends Controller
{
    public function accept(AcceptTeamInvitationRequest $request, string $token, TeamService $service): TeamResource
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return TeamResource::make($service->accept($token, $user));
    }

    public function activate(ActivateTeamInvitationRequest $request, string $token, TeamService $service): TeamResource
    {
        return TeamResource::make($service->activate($token, $request->validated()));
    }
}
