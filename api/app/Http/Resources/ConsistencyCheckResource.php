<?php

namespace App\Http\Resources;

use App\Models\ConsistencyCheck;
use App\Support\Iso;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Frontend `ConsistencyCheck` (and `ConsistencyCheckDetail` when findings are loaded).
 *
 * @mixin ConsistencyCheck
 */
class ConsistencyCheckResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'entity_type' => $this->entity_type,
            'status' => $this->status,
            'checked_count' => $this->checked_count,
            'drift_count' => $this->drift_count,
            'started_at' => Iso::utc($this->started_at),
            'finished_at' => Iso::utc($this->finished_at),
            'findings' => ConsistencyFindingResource::collection($this->whenLoaded('findings')),
        ];
    }
}
