<?php

namespace App\Http\Resources;

use App\Models\AuditEvent;
use App\Support\Iso;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin AuditEvent
 */
class AuditEventResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user' => $this->user ? ['id' => $this->user->id, 'name' => $this->user->name] : null,
            'action' => $this->action,
            'target_type' => $this->target_type,
            'target_id' => $this->target_id,
            'console' => $this->console ? ['slug' => $this->console->slug] : null,
            'details' => $this->details === null ? null : (object) $this->details,
            'created_at' => Iso::utc($this->created_at),
        ];
    }
}
