<?php

namespace App\Services;

use App\Connectors\ConsoleClient;
use App\Connectors\Exceptions\ConsoleException;
use App\Models\Console;
use App\Models\ConsoleHealthCheck;
use InvalidArgumentException;

class HealthChecker
{
    public function __construct(private ConsoleClient $client) {}

    /**
     * Probe the console, persist the result and return it.
     *
     * @return array{status: string, latency_ms: int|null, message: string}
     */
    public function check(Console $console): array
    {
        [$path, $requiresAuth] = $this->probe($console);

        try {
            $response = $this->client->request($console, 'GET', $path, null, ['auth' => $requiresAuth]);

            if (! $response->successful()) {
                throw $this->client->errorFor($console, $response);
            }

            $slow = $response->latencyMs > (int) config('consolehub.slow_threshold_ms', 2000);
            $result = [
                'status' => $slow ? 'slow' : 'ok',
                'latency_ms' => $response->latencyMs,
                'message' => $slow ? "{$console->name} lambat ({$response->latencyMs} ms)." : "{$console->name} sehat.",
            ];
        } catch (ConsoleException|InvalidArgumentException $e) {
            $result = ['status' => 'down', 'latency_ms' => null, 'message' => $e->getMessage()];
        }

        $now = now();

        $console->forceFill([
            'status' => $result['status'],
            'last_latency_ms' => $result['latency_ms'],
            'last_checked_at' => $now,
        ])->save();

        ConsoleHealthCheck::query()->create([...$result, 'console_id' => $console->id, 'checked_at' => $now]);

        return $result;
    }

    /**
     * Decide which path to probe: the configured health endpoint, or a light authenticated GET.
     *
     * @return array{0: string, 1: bool}
     */
    private function probe(Console $console): array
    {
        if ($path = $console->setting('health.path')) {
            return [(string) $path, (bool) $console->setting('health.requires_auth', false)];
        }

        $fallback = $console->setting('resources.0.list_path') ?? $console->setting('logs.path') ?? '/';

        return [(string) $fallback, true];
    }
}
