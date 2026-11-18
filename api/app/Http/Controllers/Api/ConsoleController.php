<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ConsoleRequest;
use App\Http\Resources\ConsoleResource;
use App\Models\Console;
use App\Services\Audit;
use App\Services\HealthChecker;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class ConsoleController extends Controller
{
    public function __construct(private Audit $audit) {}

    public function index(): JsonResponse
    {
        $consoles = Console::query()->with(['syncState', 'latestHealthCheck'])->orderBy('name')->get();

        return ApiResponse::list(ConsoleResource::collection($consoles), null, $consoles->count());
    }

    public function show(Console $console): ConsoleResource
    {
        return new ConsoleResource($console->load(['syncState', 'latestHealthCheck']));
    }

    public function store(ConsoleRequest $request): JsonResponse
    {
        $console = Console::query()->create($request->validated());

        $this->audit->record('console.created', 'console', (string) $console->id, $console->id, ['slug' => $console->slug]);

        return (new ConsoleResource($console))->response()->setStatusCode(201);
    }

    public function update(ConsoleRequest $request, Console $console): ConsoleResource
    {
        $console->fill($request->validated())->save();

        $this->audit->record('console.updated', 'console', (string) $console->id, $console->id, [
            'fields' => array_values(array_diff(array_keys($request->validated()), ['credentials'])),
            'credentials_changed' => $request->has('credentials'),
        ]);

        return new ConsoleResource($console->refresh());
    }

    public function destroy(Console $console): Response
    {
        $this->audit->record('console.deleted', 'console', (string) $console->id, null, ['slug' => $console->slug]);

        $console->delete();

        return response()->noContent();
    }

    public function test(Console $console, HealthChecker $checker): JsonResponse
    {
        $result = $checker->check($console);

        $this->audit->record('console.tested', 'console', (string) $console->id, $console->id, $result);

        return response()->json(['data' => $result]);
    }
}
