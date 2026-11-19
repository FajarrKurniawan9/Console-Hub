<?php

namespace App\Http\Resources;

use App\Models\AuditEvent;
use App\Support\Iso;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Frontend `AuditEvent`. `subject_*` → `target_*`. `details` = new_value plus `changes`
 * ({field: {old, new}}) for every top-level field that differs between old_value and new_value.
 *
 * @mixin AuditEvent
 */
class AuditEventResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $details = $this->new_value ?? [];

        if ($this->old_value !== null) {
            $changes = [];

            foreach (array_unique([...array_keys($this->old_value), ...array_keys($details)]) as $field) {
                $old = $this->old_value[$field] ?? null;
                $new = $details[$field] ?? null;

                if ($old != $new) {
                    $changes[$field] = ['old' => $old, 'new' => $new];
                }
            }

            $details['changes'] = (object) $changes;
        }

        $consoleSlug = $details['console'] ?? null;

        return [
            'id' => $this->id,
            'user' => $this->user ? ['id' => $this->user->id, 'name' => $this->user->name] : null,
            'action' => $this->action,
            'target_type' => $this->subject_type,
            'target_id' => $this->subject_id,
            'console' => is_string($consoleSlug) ? ['slug' => $consoleSlug] : null,
            'details' => $details === [] ? null : (object) $details,
            'created_at' => Iso::utc($this->created_at),
        ];
    }
}
