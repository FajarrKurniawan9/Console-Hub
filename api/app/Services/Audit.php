<?php

namespace App\Services;

use App\Models\AuditEvent;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Context;

/**
 * Writes `audit_events` rows in the `objek.aksi` format. Never pass secrets in old/new values.
 */
class Audit
{
    /**
     * @param  array<string, mixed>|null  $old
     * @param  array<string, mixed>|null  $new
     */
    public function record(string $action, ?string $subjectType = null, ?string $subjectId = null, ?array $old = null, ?array $new = null, ?int $userId = null): AuditEvent
    {
        return AuditEvent::query()->create([
            'user_id' => $userId ?? Auth::id(),
            'action' => $action,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'old_value' => $old,
            'new_value' => $new,
            'request_id' => Context::get('request_id'),
        ]);
    }
}
