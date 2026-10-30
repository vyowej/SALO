<?php

namespace App\Http\Controllers\Api\V1\Business;

use App\Http\Controllers\Controller;
use App\Http\Requests\Business\MenuBulkPublishRequest;
use App\Http\Requests\Business\MenuAvailabilityRequest;
use App\Http\Requests\Business\MenuCategoryRequest;
use App\Http\Requests\Business\MenuHalalCertificateRequest;
use App\Http\Requests\Business\MenuIndexRequest;
use App\Http\Requests\Business\MenuItemCreateRequest;
use App\Http\Requests\Business\MenuItemUpdateRequest;
use App\Http\Requests\Business\MenuPhotoUploadRequest;
use App\Http\Requests\Business\BusinessWorkspaceRequest;
use App\Http\Resources\MenuResource;
use App\Models\Restaurant;
use App\Models\User;
use App\Services\MenuService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MenuController extends Controller
{
    public function index(MenuIndexRequest $request, MenuService $service): MenuResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('view', $restaurant);

        return MenuResource::make($service->index($restaurant, $request->validated()));
    }

    public function storeCategory(MenuCategoryRequest $request, MenuService $service): MenuResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('manageMenu', $restaurant);

        return MenuResource::make(['category' => $service->createCategory($restaurant, $this->user($request), $request->validated())]);
    }

    public function updateCategory(MenuCategoryRequest $request, string $category, MenuService $service): MenuResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('manageMenu', $restaurant);
        abort_unless(ctype_digit($category), 404);

        return MenuResource::make([
            'category' => $service->updateCategory($restaurant, $this->user($request), (int) $category, $request->validated()),
        ]);
    }

    public function archiveCategory(BusinessWorkspaceRequest $request, string $category, MenuService $service): JsonResponse
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('manageMenu', $restaurant);
        abort_unless(ctype_digit($category), 404);
        $service->updateCategory($restaurant, $this->user($request), (int) $category, ['status' => 'archived']);

        return response()->json([], 204);
    }

    public function storeItem(MenuItemCreateRequest $request, MenuService $service): MenuResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('manageMenu', $restaurant);

        return MenuResource::make([
            'item' => $service->createItem(
                $restaurant,
                $this->user($request),
                $request->validated(),
                $request->file('file'),
            ),
        ]);
    }

    public function updateItem(MenuItemUpdateRequest $request, string $item, MenuService $service): MenuResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('manageMenu', $restaurant);
        abort_unless(ctype_digit($item), 404);

        return MenuResource::make([
            'item' => $service->updateItem($restaurant, $this->user($request), (int) $item, $request->validated()),
        ]);
    }

    public function archiveItem(BusinessWorkspaceRequest $request, string $item, MenuService $service): JsonResponse
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('manageMenu', $restaurant);
        abort_unless(ctype_digit($item), 404);
        $service->archiveItem($restaurant, $this->user($request), (int) $item);

        return response()->json([], 204);
    }

    public function bulkPublish(MenuBulkPublishRequest $request, MenuService $service): MenuResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('manageMenu', $restaurant);

        return MenuResource::make($service->bulkPublish(
            $restaurant,
            $this->user($request),
            $request->validated('item_ids'),
        ));
    }

    public function availability(MenuAvailabilityRequest $request, string $item, MenuService $service): MenuResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('manageMenuAvailability', $restaurant);
        abort_unless(ctype_digit($item), 404);
        $data = $request->validated();

        return MenuResource::make([
            'item' => $service->updateAvailability(
                $restaurant,
                $this->user($request),
                (int) $item,
                (bool) $data['is_available'],
            ),
        ]);
    }

    public function uploadPhoto(MenuPhotoUploadRequest $request, string $item, MenuService $service): MenuResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('manageMenu', $restaurant);
        abort_unless(ctype_digit($item), 404);

        return MenuResource::make([
            'item' => $service->uploadPhoto($restaurant, $this->user($request), (int) $item, $request->file('file')),
        ]);
    }

    public function uploadHalalCertificate(MenuHalalCertificateRequest $request, MenuService $service): MenuResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('manageMenu', $restaurant);
        $data = $request->validated();

        return MenuResource::make($service->uploadHalalCertificate(
            $restaurant,
            $this->user($request),
            $request->file('file'),
            $data['expiry_date'] ?? null,
        ));
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
