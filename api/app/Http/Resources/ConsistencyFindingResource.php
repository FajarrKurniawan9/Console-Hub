<?php

namespace App\Http\Resources;

use App\Models\ConsistencyFinding;
use App\Support\Iso;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Frontend `ConsistencyFinding`. `label` is the human name the check stored for the entity.
 *
 * @mixin ConsistencyFinding
 */
class ConsistencyFindingResource extends JsonResource
{
    /**
     * entity_id => label, filled by the caller before the collection is rendered.
     *
     * @var array<string, string>
     */
    public static array $labels = [];

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'check_id' => $this->check_id,
            'entity_type' => $this->entity_type,
            'entity_id' => $this->entity_id,
            'label' => self::$labels[$this->entity_id] ?? $this->entity_id,
            'console' => ['slug' => $this->console->slug, 'name' => $this->console->name],
            'kind' => $this->kind,
            'owner_version' => $this->owner_version,
            'console_version' => $this->console_version,
            'repaired_at' => Iso::utc($this->repaired_at),
        ];
    }
}
