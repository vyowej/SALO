<?php

namespace App\Http\Controllers\Api\V1\Business;

use App\Http\Controllers\Controller;
use App\Http\Requests\Business\ClosureDateRequest;
use App\Http\Requests\Business\ClosureListRequest;
use App\Http\Requests\Business\OperatingHoursRequest;
use App\Http\Requests\Business\RestaurantCloseRequest;
use App\Http\Requests\Business\RestaurantPhotoUpdateRequest;
use App\Http\Requests\Business\RestaurantPhotoUploadRequest;
use App\Http\Requests\Business\RestaurantProfileRequest;
use App\Http\Requests\Business\SensitiveProfileRequest;
use App\Http\Requests\Business\BusinessWorkspaceRequest;
use App\Http\Resources\BusinessWorkspaceResource;
use App\Models\Restaurant;
use App\Models\User;
use App\Services\RestaurantPageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RestaurantPageController extends Controller
{
    public function profile(BusinessWorkspaceRequest $request, RestaurantPageService $service): BusinessWorkspaceResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('view', $restaurant);

        return BusinessWorkspaceResource::make($service->profile($restaurant));
    }

    public function updateProfile(RestaurantProfileRequest $request, RestaurantPageService $service): BusinessWorkspaceResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('edit', $restaurant);

        return BusinessWorkspaceResource::make($service->updateProfile(
            $restaurant,
            $this->user($request),
            $request->validated(),
        ));
    }

    public function proposeSensitiveUpdate(SensitiveProfileRequest $request, RestaurantPageService $service): BusinessWorkspaceResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('editSensitive', $restaurant);
        $data = $request->validated();

        return BusinessWorkspaceResource::make($service->proposeSensitiveUpdate(
            $restaurant,
            $this->user($request),
            $data['proposed_changes'],
            $request->file('permit_files', []),
            $data['permit_expiry_date'] ?? null,
        ));
    }

    public function preview(BusinessWorkspaceRequest $request, RestaurantPageService $service): BusinessWorkspaceResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('view', $restaurant);

        return BusinessWorkspaceResource::make($service->preview($restaurant));
    }

    public function photos(BusinessWorkspaceRequest $request, RestaurantPageService $service): BusinessWorkspaceResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('view', $restaurant);

        return BusinessWorkspaceResource::make($service->photos($restaurant));
    }

    public function uploadPhoto(RestaurantPhotoUploadRequest $request, RestaurantPageService $service): BusinessWorkspaceResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('managePhotos', $restaurant);
        $data = $request->validated();

        return BusinessWorkspaceResource::make($service->uploadPhoto(
            $restaurant,
            $this->user($request),
            $data['kind'],
            $request->file('file'),
            $request->file('thumbnail'),
            $request->file('medium'),
            $data['alt_text'] ?? null,
        ));
    }

    public function updatePhoto(
        RestaurantPhotoUpdateRequest $request,
        string $photo,
        RestaurantPageService $service,
    ): BusinessWorkspaceResource {
        $restaurant = $this->restaurant($request);
        $this->authorize('managePhotos', $restaurant);
        abort_unless(ctype_digit($photo), 404);

        return BusinessWorkspaceResource::make($service->updatePhoto(
            $restaurant,
            $this->user($request),
            (int) $photo,
            $request->validated(),
        ));
    }

    public function deletePhoto(BusinessWorkspaceRequest $request, string $photo, RestaurantPageService $service): JsonResponse
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('managePhotos', $restaurant);
        $service->deletePhoto($restaurant, $this->user($request), $photo);

        return response()->json([], 204);
    }

    public function hours(BusinessWorkspaceRequest $request, RestaurantPageService $service): BusinessWorkspaceResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('view', $restaurant);

        return BusinessWorkspaceResource::make($service->hours($restaurant));
    }

    public function updateHours(OperatingHoursRequest $request, RestaurantPageService $service): BusinessWorkspaceResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('manageHours', $restaurant);
        $data = $request->validated();

        return BusinessWorkspaceResource::make($service->updateHours(
            $restaurant,
            $this->user($request),
            (bool) $data['is_24_7'],
            $data['hours'],
        ));
    }

    public function closures(ClosureListRequest $request, RestaurantPageService $service): BusinessWorkspaceResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('view', $restaurant);
        $data = $request->validated();

        return BusinessWorkspaceResource::make([
            'closures' => $service->closures($restaurant, $data['from'] ?? null, $data['to'] ?? null),
        ]);
    }

    public function createClosure(ClosureDateRequest $request, RestaurantPageService $service): BusinessWorkspaceResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('manageHours', $restaurant);

        return BusinessWorkspaceResource::make([
            'closure' => $service->createClosure($restaurant, $this->user($request), $request->validated()),
        ]);
    }

    public function deleteClosure(BusinessWorkspaceRequest $request, int $closure, RestaurantPageService $service): JsonResponse
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('manageHours', $restaurant);
        $service->deleteClosure($restaurant, $this->user($request), $closure);

        return response()->json([], 204);
    }

    public function publish(BusinessWorkspaceRequest $request, RestaurantPageService $service): BusinessWorkspaceResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('publish', $restaurant);

        return BusinessWorkspaceResource::make($service->publish($restaurant, $this->user($request)));
    }

    public function publishChecklist(BusinessWorkspaceRequest $request, RestaurantPageService $service): BusinessWorkspaceResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('view', $restaurant);

        return BusinessWorkspaceResource::make($service->publishChecklist($restaurant));
    }

    public function unpublish(BusinessWorkspaceRequest $request, RestaurantPageService $service): BusinessWorkspaceResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('publish', $restaurant);

        return BusinessWorkspaceResource::make($service->unpublish($restaurant, $this->user($request)));
    }

    public function close(RestaurantCloseRequest $request, RestaurantPageService $service): BusinessWorkspaceResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('publish', $restaurant);
        $data = $request->validated();

        return BusinessWorkspaceResource::make($service->setClosed(
            $restaurant,
            $this->user($request),
            (bool) $data['closed'],
            $data['reason'] ?? null,
        ));
    }

    public function deactivate(BusinessWorkspaceRequest $request, RestaurantPageService $service): BusinessWorkspaceResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('publish', $restaurant);

        return BusinessWorkspaceResource::make($service->deactivate($restaurant, $this->user($request)));
    }

    public function reactivate(BusinessWorkspaceRequest $request, RestaurantPageService $service): BusinessWorkspaceResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('publish', $restaurant);

        return BusinessWorkspaceResource::make($service->reactivate($restaurant, $this->user($request)));
    }

    private function restaurant(Request $request): Restaurant
    {
        $restaurant = $request->attributes->get('restaurant');
        abort_unless($restaurant instanceof Restaurant, 404);

        return $restaurant;
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
