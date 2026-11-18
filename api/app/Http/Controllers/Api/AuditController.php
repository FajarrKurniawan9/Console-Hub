<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AuditIndexRequest;
use App\Http\Resources\AuditEventResource;
use App\Models\AuditEvent;
use App\Support\ApiResponse;
use App\Support\Cursor;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

class AuditController extends Controller
{
    public function __invoke(AuditIndexRequest $request): JsonResponse
    {
        $query = AuditEvent::query()
            ->with(['user:id,name', 'console:id,slug'])
            ->when($request->validated('user_id'), fn ($q, $id) => $q->where('user_id', $id))
            ->when($request->validated('console_id'), fn ($q, $id) => $q->where('console_id', $id))
            ->when($request->validated('action'), fn ($q, $action) => $q->where('action', $action))
            ->when($request->validated('from'), fn ($q, $from) => $q->where('created_at', '>=', Carbon::parse($from)->utc()))
            ->when($request->validated('to'), fn ($q, $to) => $q->where('created_at', '<=', Carbon::parse($to)->utc()));

        [$rows, $next] = Cursor::paginate($query, 'created_at', $request->validated('cursor'), (int) $request->validated('limit', 50));

        return ApiResponse::list(AuditEventResource::collection($rows), $next);
    }
}
