<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditEventResource;
use App\Http\Resources\ConsoleResource;
use App\Models\AuditEvent;
use App\Models\Console;
use App\Models\LogEntry;
use Illuminate\Http\JsonResponse;

class OverviewController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json(['data' => [
            'sources' => ConsoleResource::collection(Console::query()->withRecentHealth()->orderBy('id')->get()),
            'log_errors_24h' => LogEntry::query()->where('level', 'error')->where('occurred_at', '>=', now()->subDay())->count(),
            'recent_audit' => AuditEventResource::collection(
                AuditEvent::query()->with('user:id,name')->latest()->orderByDesc('id')->limit(10)->get()
            ),
        ]]);
    }
}
