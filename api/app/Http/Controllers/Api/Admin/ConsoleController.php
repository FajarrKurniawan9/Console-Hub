<?php

namespace App\Http\Controllers\Api\Admin;

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
        $consoles = Console::query()->withRecentHealth()->orderBy('id')->get();

        return ApiResponse::list(ConsoleResource::collection($consoles), null, $consoles->count());
    }

    public function show(Console $console): ConsoleResource
    {
        return new ConsoleResource($console->load(['recentHealthChecks' => fn ($q) => $q->limit(HealthChecker::DOWN_AFTER)]));
    }

    public function store(ConsoleRequest $request): JsonResponse
    {
        $console = Console::query()->create($request->validated());

        $this->audit->record('console.created', 'console', (string) $console->id, null, $this->auditable($console));

        return (new ConsoleResource($console))->response()->setStatusCode(201);
    }

    public function update(ConsoleRequest $request, Console $console): ConsoleResource
    {
        $old = $this->auditable($console);
        $console->fill($request->validated())->save();
        $new = $this->auditable($console);

        if ($request->has('service_key')) {
            $new['service_key_changed'] = true;
        }

        $this->audit->record('console.updated', 'console', (string) $console->id, $old, $new);

        return new ConsoleResource($console->refresh());
    }

    public function destroy(Console $console): Response
    {
        $this->audit->record('console.deleted', 'console', (string) $console->id, $this->auditable($console));

        $console->delete();

        return response()->noContent();
    }

    public function test(Console $console, HealthChecker $checker): JsonResponse
    {
        $result = $checker->check($console);

        $this->audit->record('console.tested', 'console', (string) $console->id, null, [
            'console' => $console->slug, 'status' => $result['status'], 'latency_ms' => $result['latency_ms'],
        ]);

        return response()->json(['data' => $result]);
    }

    /**
     * Console fields safe to keep in the audit trail (never the service key).
     *
     * @return array<string, mixed>
     */
    private function auditable(Console $console): array
    {
        return ['console' => $console->slug, ...$console->only(['name', 'base_url', 'auth_type', 'is_active', 'resource'])];
    }
}
