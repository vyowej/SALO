<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerRestaurantReviewResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->resource->id,
            'author_label' => 'SALO customer',
            'rating' => (int) $this->resource->rating,
            'comment' => $this->resource->comment,
            'reply' => $this->resource->reply,
            'replied_at' => $this->resource->replied_at,
            'created_at' => $this->resource->created_at,
        ];
    }
}
