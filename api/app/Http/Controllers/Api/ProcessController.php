<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProcessRequest;
use App\Http\Requests\StartRunRequest;
use App\Http\Resources\ProcessResource;
use App\Models\Console;
use App\Models\Process;
use App\Services\Audit;
use App\Services\RunFactory;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class ProcessController extends Controller
{
    public function __construct(private Audit $audit) {}

    public function index(): JsonResponse
    {
        $processes = Process::query()->with('steps.console')->orderBy('name')->get();

        return ApiResponse::list(ProcessResource::collection($processes), null, $processes->count());
    }

    public function show(Process $process): ProcessResource
    {
        return new ProcessResource($process->load('steps.console'));
    }

    public function store(ProcessRequest $request): JsonResponse
    {
        $process = DB::transaction(function () use ($request) {
            $process = Process::query()->create([...$this->attributes($request), 'created_by' => $request->user()?->id]);
            $this->syncSteps($process, $request->validated('steps'));

            return $process;
        });

        $this->audit->record('process.created', 'process', (string) $process->id, null, ['name' => $process->name]);

        return (new ProcessResource($process->load('steps.console')))->response()->setStatusCode(201);
    }

    public function update(ProcessRequest $request, Process $process): ProcessResource
    {
        DB::transaction(function () use ($request, $process) {
            $process->update($this->attributes($request));
            $this->syncSteps($process, $request->validated('steps'));
        });

        $this->audit->record('process.updated', 'process', (string) $process->id, null, ['name' => $process->name]);

        return new ProcessResource($process->refresh()->load('steps.console'));
    }

    /**
     * Runs keep their own step snapshots, so deleting a definition never removes history.
     * A process that has runs is deactivated instead of deleted, because runs reference it.
     */
    public function destroy(Process $process): Response
    {
        if ($process->runs()->exists()) {
            $process->update(['is_active' => false]);
            $process->steps()->delete();
        } else {
            $process->delete();
        }

        $this->audit->record('process.deleted', 'process', (string) $process->id, null, ['name' => $process->name]);

        return response()->noContent();
    }

    public function run(StartRunRequest $request, Process $process, RunFactory $runs): JsonResponse
    {
        $run = $runs->start($process->load('steps'), (array) $request->validated('input'));

        return response()->json(['data' => [
            'id' => $run->id,
            'process' => ['id' => $process->id, 'name' => $process->name],
            'status' => 'queued',
        ]], 202);
    }

    /**
     * @return array<string, mixed>
     */
    private function attributes(ProcessRequest $request): array
    {
        return [
            'name' => $request->validated('name'),
            'description' => (string) $request->validated('description', ''),
            'is_active' => (bool) $request->validated('is_active', true),
            'compensate_on_failure' => (bool) $request->validated('compensate_on_failure', false),
            'input_schema' => $request->validated('input_schema'),
        ];
    }

    /**
     * Replace the step definitions; existing run_steps keep their copied name and console.
     *
     * @param  list<array<string, mixed>>  $steps
     */
    private function syncSteps(Process $process, array $steps): void
    {
        $consoles = Console::query()->whereIn('slug', array_column($steps, 'console'))->pluck('id', 'slug');

        $process->steps()->delete();

        foreach (collect($steps)->sortBy('position') as $step) {
            $process->steps()->create([
                'position' => $step['position'],
                'name' => $step['name'],
                'console_id' => $consoles[$step['console']],
                'method' => $step['method'],
                'path' => $step['path'],
                'body_template' => $step['body'] ?? null,
                'expect_status' => $step['expect_status'] ?? [200, 201, 204],
                'timeout_seconds' => $step['timeout_seconds'] ?? 10,
                'max_retries' => $step['max_retries'] ?? 0,
                'on_failure' => $step['on_failure'] ?? 'stop',
                'compensation' => $step['compensation'] ?? null,
            ]);
        }
    }
}
