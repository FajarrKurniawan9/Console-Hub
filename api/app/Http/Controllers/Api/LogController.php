<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LogIndexRequest;
use App\Http\Requests\LogSyncRequest;
use App\Http\Resources\LogEntryResource;
use App\Models\Console;
use App\Models\LogEntry;
use App\Services\Audit;
use App\Services\LogSync;
use App\Support\ApiResponse;
use App\Support\Cursor;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

class LogController extends Controller
{
    public function index(LogIndexRequest $request): JsonResponse
    {
        $query = LogEntry::query()->with('console:id,slug,name');

        if ($consoleIds = $request->csv('console_id')) {
            $query->whereIn('console_id', array_map('intval', $consoleIds));
        }

        if ($levels = $request->csv('level')) {
            $query->whereIn('level', $levels);
        }

        if ($text = $request->validated('q')) {
            $like = '%'.addcslashes($text, '%_\\').'%';
            $query->where(fn ($q) => $q->where('message', 'ilike', $like)->orWhere('actor', 'ilike', $like));
        }

        if ($from = $request->validated('from')) {
            $query->where('occurred_at', '>=', Carbon::parse($from)->utc());
        }

        if ($to = $request->validated('to')) {
            $query->where('occurred_at', '<=', Carbon::parse($to)->utc());
        }

        [$rows, $next] = Cursor::paginate($query, 'occurred_at', $request->validated('cursor'), (int) $request->validated('limit', 50));

        return ApiResponse::list(LogEntryResource::collection($rows), $next);
    }

    public function show(LogEntry $log): LogEntryResource
    {
        return (new LogEntryResource($log->load('console:id,slug,name')))->withRaw();
    }

    public function sync(LogSyncRequest $request, LogSync $sync, Audit $audit): JsonResponse
    {
        $consoleId = $request->validated('console_id');
        $consoles = Console::query()
            ->when($consoleId, fn ($q) => $q->whereKey($consoleId), fn ($q) => $q->where('is_active', true))
            ->orderBy('name')
            ->get();

        set_time_limit(max(60, $consoles->count() * 30));

        $results = $consoles->map(function (Console $console) use ($sync) {
            $result = $sync->syncConsole($console);

            return [
                'console' => ['slug' => $console->slug, 'name' => $console->name],
                'ok' => $result['status'] === 'ok',
                'fetched' => $result['status'] === 'ok' ? $result['inserted'] : null,
                'message' => $result['error'],
            ];
        })->values();

        $audit->record('logs.synced', null, null, $consoleId ? (int) $consoleId : null, [
            'results' => $results->map(fn ($r) => ['console' => $r['console']['slug'], 'ok' => $r['ok'], 'fetched' => $r['fetched']])->all(),
        ]);

        return response()->json(['data' => ['results' => $results]], 202);
    }
}
