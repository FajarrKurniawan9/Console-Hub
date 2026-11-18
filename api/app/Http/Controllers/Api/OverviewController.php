<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ConsoleResource;
use App\Http\Resources\RunResource;
use App\Models\Console;
use App\Models\LogEntry;
use App\Models\ProcessRun;
use Illuminate\Http\JsonResponse;

class OverviewController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json(['data' => [
            'consoles' => ConsoleResource::collection(Console::query()->with(['syncState', 'latestHealthCheck'])->orderBy('name')->get()),
            'error_logs_24h' => LogEntry::query()->where('level', 'error')->where('occurred_at', '>=', now()->subDay())->count(),
            'recent_runs' => RunResource::collection(
                ProcessRun::query()->with(['process:id,name', 'triggeredBy:id,name'])->latest()->orderByDesc('id')->limit(5)->get()
            ),
        ]]);
    }
}
