<?php

namespace App\Services;

use App\Connectors\ConsoleClient;
use App\Connectors\Exceptions\ConsoleException;
use App\Models\Console;
use App\Models\ConsoleHealthCheck;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use InvalidArgumentException;

class HealthChecker
{
    /** Consecutive failed checks before a console counts as down. */
    public const DOWN_AFTER = 3;

    public function __construct(private ConsoleClient $client) {}

    /**
     * Call GET /health (no key), store the result and return it in the ConsoleTest shape.
     *
     * @return array{status: 'ok'|'slow'|'down', latency_ms: int|null, message: string}
     */
    public function check(Console $console): array
    {
        try {
            $response = $this->client->raw($console, 'GET', '/health');

            if (! $response->successful()) {
                throw $this->client->errorFor($console, $response);
            }

            $ok = true;
            $latency = $response->latencyMs;
            $error = null;
        } catch (ConsoleException|InvalidArgumentException $e) {
            $ok = false;
            $latency = null;
            $error = $e->getMessage();
        }

        ConsoleHealthCheck::query()->create([
            'console_id' => $console->id,
            'ok' => $ok,
            'latency_ms' => $latency,
            'error' => $error,
            'checked_at' => now(),
        ]);

        if (! $ok) {
            return ['status' => 'down', 'latency_ms' => null, 'message' => (string) $error];
        }

        $slow = $latency > (int) config('consolehub.slow_threshold_ms');

        return [
            'status' => $slow ? 'slow' : 'ok',
            'latency_ms' => $latency,
            'message' => $slow ? "{$console->name} lambat ({$latency} ms)." : "{$console->name} sehat ({$latency} ms).",
        ];
    }

    /**
     * Status shown in the API from the latest checks: down after DOWN_AFTER failures in a row,
     * slow above the threshold, unknown before the first check.
     *
     * @return array{status: 'ok'|'slow'|'down'|'unknown', last_latency_ms: int|null, last_checked_at: Carbon|null, last_error: string|null}
     */
    public static function summarize(Console $console): array
    {
        /** @var Collection<int, ConsoleHealthCheck> $recent */
        $recent = $console->relationLoaded('recentHealthChecks')
            ? $console->getRelation('recentHealthChecks')
            : $console->healthChecks()->latest('checked_at')->limit(self::DOWN_AFTER)->get();

        $latest = $recent->first();

        if ($latest === null) {
            return ['status' => 'unknown', 'last_latency_ms' => null, 'last_checked_at' => null, 'last_error' => null];
        }

        $down = $recent->count() >= self::DOWN_AFTER && $recent->every(fn (ConsoleHealthCheck $c) => ! $c->ok);
        $lastOk = $recent->firstWhere('ok', true);

        $status = match (true) {
            $down => 'down',
            $latest->ok && $latest->latency_ms > (int) config('consolehub.slow_threshold_ms') => 'slow',
            $latest->ok => 'ok',
            // One or two failures: keep the last good reading rather than flapping to "down".
            default => $lastOk && $lastOk->latency_ms > (int) config('consolehub.slow_threshold_ms') ? 'slow' : 'ok',
        };

        return [
            'status' => $status,
            'last_latency_ms' => $latest->latency_ms,
            'last_checked_at' => $latest->checked_at,
            'last_error' => $latest->ok ? null : $latest->error,
        ];
    }
}
