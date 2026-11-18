<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ResourceIndexRequest;
use App\Http\Requests\ResourceUpdateRequest;
use App\Http\Resources\ConsoleResource;
use App\Models\Console;
use App\Services\ResourceGateway;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ResourceController extends Controller
{
    public function __construct(private ResourceGateway $gateway) {}

    public function index(Request $request, Console $console): JsonResponse
    {
        $resources = (new ConsoleResource($console))->toArray($request)['resources'];

        return ApiResponse::list($resources, null, count($resources));
    }

    public function show(ResourceIndexRequest $request, Console $console, string $key): JsonResponse
    {
        $result = $this->gateway->list(
            $console,
            $key,
            (int) $request->validated('page', 1),
            (int) $request->validated('per_page', 20),
            $request->validated('q'),
        );

        return ApiResponse::list($result['data'], $result['next_cursor'], $result['total']);
    }

    public function update(ResourceUpdateRequest $request, Console $console, string $key, string $recordId): JsonResponse
    {
        $record = $this->gateway->update($console, $key, $recordId, (array) $request->validated('fields'));

        return response()->json(['data' => (object) $record]);
    }
}
