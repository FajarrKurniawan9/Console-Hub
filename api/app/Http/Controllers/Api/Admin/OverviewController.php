<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ConsistencyCheckResource;
use App\Http\Resources\ConsoleResource;
use App\Http\Resources\TransactionResource;
use App\Models\ConsistencyCheck;
use App\Models\Console;
use App\Models\LogEntry;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;

class OverviewController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $lastCheck = ConsistencyCheck::query()->latest('started_at')->orderByDesc('id')->first();

        return response()->json(['data' => [
            'consoles' => ConsoleResource::collection(Console::query()->withRecentHealth()->orderBy('id')->get()),
            'error_logs_24h' => LogEntry::query()->where('level', 'error')->where('occurred_at', '>=', now()->subDay())->count(),
            'tx_counts' => (object) Transaction::query()->selectRaw('state, count(*) as n')->groupBy('state')->pluck('n', 'state')->map(fn ($n) => (int) $n)->all(),
            'recent_transactions' => TransactionResource::collection(
                Transaction::query()->with(['requester:id,name', 'participants.console:id,slug,name'])->latest()->orderByDesc('id')->limit(10)->get()
            ),
            'last_consistency' => $lastCheck ? new ConsistencyCheckResource($lastCheck) : null,
        ]]);
    }
}
