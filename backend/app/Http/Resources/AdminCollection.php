<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;

class AdminCollection extends ResourceCollection
{
    public function __construct($resource, private readonly array $meta = [])
    {
        parent::__construct($resource);
    }

    public function toArray(Request $request): array
    {
        return $this->collection->all();
    }

    public function with(Request $request): array
    {
        return $this->meta === [] ? [] : ['meta' => $this->meta];
    }
}
