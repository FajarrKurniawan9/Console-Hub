<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Resources\LogResource;
use App\Models\AppLog;
use App\Support\Cursor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Throwable;

class LogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = AppLog::query();

        if ($request->filled('since')) {
            try {
                $since = Carbon::parse((string) $request->query('since'))->utc();
                $query->where('occurred_at', '>=', $since);
            } catch (Throwable) {
                throw ApiException::validation([
                    'since' => ['Format parameter since tidak valid.'],
                ]);
            }
        }

        $limit = (int) $request->query('limit', 25);
        if ($limit < 1 || $limit > 100) {
            $limit = min(100, max(1, $limit));
        }

        [$logs, $nextCursor] = Cursor::paginate($query, 'occurred_at', $request->query('cursor'), $limit);

        return response()->json([
            'data' => LogResource::collection($logs),
            'meta' => [
                'next_cursor' => $nextCursor,
            ],
        ]);
    }
}
