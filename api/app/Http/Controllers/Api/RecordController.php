<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RecordRequest;
use App\Http\Resources\RecordResource;
use App\Services\Domain\RecordService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;

/**
 * `/items`, `/productions`, `/people`: one controller, the resource comes from the route default.
 */
class RecordController extends Controller
{
    /** List filters each owner API accepts (besides q, status, cursor, limit). */
    private const FILTERS = ['items' => ['kind'], 'productions' => ['production_type'], 'people' => ['role']];

    public function __construct(private RecordService $records) {}

    public function index(Request $request): JsonResponse
    {
        $resource = $this->resource($request);
        $query = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', 'in:aktif,nonaktif,all'],
            'cursor' => ['nullable', 'string', 'max:500'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
            ...array_fill_keys(self::FILTERS[$resource], ['nullable', 'string', 'max:80']),
        ]);

        $page = $this->records->list($resource, $query);

        return ApiResponse::merged(RecordResource::many($resource, $page['data']), $page['next_cursor'], $page['unavailable']);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $resource = $this->resource($request);

        return response()->json(['data' => new RecordResource($this->records->find($resource, $id), $resource)]);
    }

    public function store(RecordRequest $request): JsonResponse
    {
        $resource = $this->resource($request);

        return response()->json(['data' => new RecordResource($this->records->create($resource, $request->validated()), $resource)], 201);
    }

    public function update(RecordRequest $request, string $id): JsonResponse
    {
        $resource = $this->resource($request);

        return response()->json(['data' => new RecordResource($this->records->update($resource, $id, $request->validated()), $resource)]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $resource = $this->resource($request);
        $version = (int) Arr::get($request->validate(['expected_version' => ['required', 'integer', 'min:1']]), 'expected_version');
        $technical = (bool) $request->user()?->hasPermission('admin.consoles.view');

        return response()->json(['data' => new RecordResource($this->records->deactivate($resource, $id, $version, $technical), $resource)]);
    }

    /**
     * @return 'items'|'productions'|'people'
     */
    private function resource(Request $request): string
    {
        return $request->route()->defaults['resource'];
    }
}
