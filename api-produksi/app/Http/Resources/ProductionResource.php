<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'area' => (string) $this->area,
            'production_type' => (string) $this->production_type,
            'courier_id' => $this->courier_id !== null ? (string) $this->courier_id : null,
            'status' => (string) $this->status,
            'version' => (int) $this->version,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
