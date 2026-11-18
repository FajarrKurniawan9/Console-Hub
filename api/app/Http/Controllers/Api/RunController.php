<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RunIndexRequest;
use App\Http\Resources\RunResource;
use App\Models\ProcessRun;
use App\Services\RunFactory;
use App\Support\ApiResponse;
use App\Support\Cursor;
use Illuminate\Http\JsonResponse;

class RunController extends Controller
{
    public function __construct(private RunFactory $runs) {}

    public function index(RunIndexRequest $request): JsonResponse
    {
        $query = ProcessRun::query()->with(['process:id,name', 'triggeredBy:id,name']);

        if ($processIds = $request->csv('process_id')) {
            $query->whereIn('process_id', array_map('intval', $processIds));
        }

        if ($statuses = $request->csv('status')) {
            $query->whereIn('status', $statuses);
        }

        [$rows, $next] = Cursor::paginate($query, 'created_at', $request->validated('cursor'), (int) $request->validated('limit', 25));

        return ApiResponse::list(RunResource::collection($rows), $next);
    }

    public function show(string $run): RunResource
    {
        return new RunResource($this->find($run)->load(['process:id,name', 'triggeredBy:id,name', 'steps.console:id,slug']));
    }

    public function retry(string $run): JsonResponse
    {
        $retry = $this->runs->retry($this->find($run));

        return response()->json(['data' => ['id' => $retry->id, 'status' => $retry->status]], 202);
    }

    public function cancel(string $run): RunResource
    {
        $canceled = $this->runs->cancel($this->find($run)->load('process'));

        return new RunResource($canceled->load(['process:id,name', 'triggeredBy:id,name', 'steps.console:id,slug']));
    }

    /**
     * Find a run by UUID; anything that is not a UUID is simply not found (avoids a pgsql cast error).
     */
    private function find(string $id): ProcessRun
    {
        abort_unless((bool) preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $id), 404);

        return ProcessRun::query()->findOrFail($id);
    }
}
