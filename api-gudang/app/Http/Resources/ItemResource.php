<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'name' => (string) $this->name,
            'kind' => (string) $this->kind,
            'production_id' => $this->production_id !== null ? (string) $this->production_id : null,
            'responsible_id' => $this->responsible_id !== null ? (string) $this->responsible_id : null,
            'quantity' => (int) $this->quantity,
            'unit' => (string) $this->unit,
            'status' => (string) $this->status,
            'version' => (int) $this->version,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
