<?php

namespace App\Services;

use App\Models\AuditEvent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class Audit
{
    public function __construct(private Request $request) {}

    /**
     * Record an audit event for the current user and request IP.
     *
     * @param  array<string, mixed>|null  $details
     */
    public function record(string $action, ?string $targetType = null, ?string $targetId = null, ?int $consoleId = null, ?array $details = null, ?int $userId = null): AuditEvent
    {
        return AuditEvent::query()->create([
            'user_id' => $userId ?? Auth::id(),
            'action' => $action,
            'target_type' => $targetType,
            'target_id' => $targetId,
            'console_id' => $consoleId,
            'details' => $details,
            'ip' => app()->runningInConsole() && ! app()->runningUnitTests() ? null : $this->request->ip(),
        ]);
    }
}
