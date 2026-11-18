<?php

namespace App\Services;

use App\Connectors\ConsoleClient;
use App\Connectors\ConsoleResponse;
use App\Connectors\Exceptions\ConsoleException;
use App\Models\ProcessRun;
use App\Models\ProcessStep;
use App\Models\RunStep;
use App\Services\Exceptions\TemplateException;
use Illuminate\Support\Collection;
use Illuminate\Support\Sleep;
use InvalidArgumentException;

/**
 * Executes a run's steps in order with retries, compensation and cancellation.
 */
class ProcessRunner
{
    /** Delays (seconds) between step retries. */
    private const RETRY_DELAYS = [1, 2, 4];

    public function __construct(
        private ConsoleClient $client,
        private TemplateRenderer $templates,
        private Audit $audit,
    ) {}

    public function run(ProcessRun $run): void
    {
        $claimed = ProcessRun::query()->whereKey($run->id)->where('status', 'queued')
            ->update(['status' => 'running', 'started_at' => now(), 'updated_at' => now()]);

        if ($claimed === 0) {
            return;
        }

        $run->refresh()->load(['process', 'steps.processStep.console']);
        $context = ['input' => $run->input ?? [], 'steps' => []];
        $failure = null;

        foreach ($run->steps as $step) {
            if ($step->status === 'succeeded') {
                $context['steps'][(string) $step->position] = $this->stepContext($step);

                continue;
            }

            if ($this->isCanceled($run)) {
                $this->skipPending($run);

                return;
            }

            $this->execute($step, $context);

            if ($step->status === 'succeeded') {
                $context['steps'][(string) $step->position] = $this->stepContext($step);

                continue;
            }

            if ($step->processStep?->on_failure === 'continue') {
                continue;
            }

            $failure = $step;
            break;
        }

        if ($failure === null) {
            $this->finish($run, 'succeeded', null);

            return;
        }

        $this->skipPending($run);

        if ($run->process->compensate_on_failure) {
            $this->compensate($run->steps->where('status', 'succeeded')->sortByDesc('position'), $context);
        }

        $this->finish($run, 'failed', "Langkah {$failure->position} gagal: {$this->shortError($failure)}");
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function execute(RunStep $step, array $context): void
    {
        $definition = $step->processStep;

        if (! $definition || ! $definition->console) {
            $this->fail($step, 'Definisi langkah atau console sudah dihapus.');

            return;
        }

        $step->forceFill(['status' => 'running', 'started_at' => now()])->save();

        try {
            $path = $this->templates->renderPath($definition->path, $context);
            $body = $definition->body_template === null ? null : $this->templates->render($definition->body_template, $context);
        } catch (TemplateException $e) {
            $this->fail($step, "TEMPLATE_ERROR: {$e->getMessage()}");

            return;
        }

        $attempt = 0;

        while (true) {
            $attempt++;
            [$response, $error, $retryable] = $this->call($definition, $definition->method, $path, $body, $definition->timeout_seconds);

            $step->forceFill([
                'attempt' => $attempt,
                'request' => $this->requestRecord($definition, $definition->method, $path, $body),
                'response_status' => $response?->status,
                'response_body' => $response?->body,
                'duration_ms' => $response?->latencyMs,
            ]);

            if ($response && in_array($response->status, $definition->expect_status ?? [200, 201, 204], true)) {
                $step->forceFill(['status' => 'succeeded', 'error' => null, 'finished_at' => now()])->save();

                return;
            }

            $error ??= "{$definition->console->name} menjawab HTTP {$response?->status}, diharapkan ".implode('/', $definition->expect_status ?? []).'.';

            if (! $retryable || $attempt > $definition->max_retries) {
                $this->fail($step, $error);

                return;
            }

            $step->forceFill(['error' => $error])->save();
            Sleep::for(self::RETRY_DELAYS[min($attempt - 1, count(self::RETRY_DELAYS) - 1)])->seconds();
        }
    }

    /**
     * @param  Collection<int, RunStep>  $succeeded
     * @param  array<string, mixed>  $context
     */
    private function compensate(Collection $succeeded, array $context): void
    {
        foreach ($succeeded as $step) {
            $definition = $step->processStep;
            $compensation = $definition?->compensation;

            if (! $compensation || ! $definition->console) {
                continue;
            }

            try {
                $method = strtoupper($compensation['method'] ?? 'POST');
                $path = $this->templates->renderPath((string) ($compensation['path'] ?? ''), $context);
                $body = isset($compensation['body']) ? $this->templates->render($compensation['body'], $context) : null;
            } catch (TemplateException $e) {
                $step->forceFill(['status' => 'compensation_failed', 'error' => "Kompensasi: TEMPLATE_ERROR: {$e->getMessage()}"])->save();

                continue;
            }

            [$response, $error] = $this->call($definition, $method, $path, $body, $definition->timeout_seconds);
            $ok = $response && $response->successful();

            $step->forceFill([
                'status' => $ok ? 'compensated' : 'compensation_failed',
                'error' => $ok ? null : 'Kompensasi gagal: '.($error ?? "HTTP {$response?->status}"),
            ])->save();
        }
    }

    /**
     * @param  array<string, mixed>|list<mixed>|null  $body
     * @return array{0: ConsoleResponse|null, 1: string|null, 2: bool}
     */
    private function call(ProcessStep $definition, string $method, string $path, mixed $body, int $timeout): array
    {
        try {
            $response = $this->client->request($definition->console, $method, $path, is_array($body) ? $body : null, [
                'timeout' => $timeout,
                'retry' => false,
            ]);

            return [$response, null, in_array($response->status, ConsoleClient::RETRYABLE_STATUSES, true)];
        } catch (ConsoleException $e) {
            return [null, $e->getMessage(), in_array($e->errorCode, ['CONSOLE_TIMEOUT', 'CONSOLE_UNREACHABLE'], true)];
        } catch (InvalidArgumentException $e) {
            return [null, $e->getMessage(), false];
        }
    }

    /**
     * @param  array<string, mixed>|list<mixed>|null  $body
     * @return array{method: string, url: string, body?: mixed}
     */
    private function requestRecord(ProcessStep $definition, string $method, string $path, mixed $body): array
    {
        return array_filter([
            'method' => strtoupper($method),
            'url' => rtrim($definition->console->base_url, '/').$path,
            'body' => $body,
        ], fn ($v) => $v !== null);
    }

    /**
     * @return array{response: array{status: int|null, body: mixed}}
     */
    private function stepContext(RunStep $step): array
    {
        return ['response' => ['status' => $step->response_status, 'body' => $step->response_body]];
    }

    private function fail(RunStep $step, string $error): void
    {
        $step->forceFill(['status' => 'failed', 'error' => $error, 'finished_at' => now()])->save();
    }

    private function shortError(RunStep $step): string
    {
        return mb_strimwidth((string) $step->error, 0, 200, '…');
    }

    private function isCanceled(ProcessRun $run): bool
    {
        return ProcessRun::query()->whereKey($run->id)->value('status') === 'canceled';
    }

    private function skipPending(ProcessRun $run): void
    {
        $run->steps()->where('status', 'pending')->update(['status' => 'skipped', 'updated_at' => now()]);
        $run->load('steps.processStep.console');
    }

    private function finish(ProcessRun $run, string $status, ?string $summary): void
    {
        $updated = ProcessRun::query()->whereKey($run->id)->where('status', 'running')
            ->update(['status' => $status, 'error_summary' => $summary, 'finished_at' => now(), 'updated_at' => now()]);

        if ($updated > 0) {
            $this->audit->record("run.{$status}", 'run', $run->id, null, [
                'process' => $run->process->name,
                ...($summary ? ['error' => $summary] : []),
            ], $run->triggered_by);
        }
    }
}
