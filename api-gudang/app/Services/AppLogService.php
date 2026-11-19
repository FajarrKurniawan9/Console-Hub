<?php

namespace App\Services;

use App\Models\AppLog;
use Illuminate\Http\Request;
use Throwable;

class AppLogService
{
    public const VALID_LEVELS = ['debug', 'info', 'warn', 'error'];

    /**
     * @param  array<string, mixed>|null  $context
     */
    public function log(string $level, string $message, ?array $context = null, ?Request $request = null): AppLog
    {
        $level = strtolower($level);
        if (! in_array($level, self::VALID_LEVELS, true)) {
            $level = $level === 'warning' ? 'warn' : 'info';
        }

        $request ??= request();

        $actor = null;
        if ($request instanceof Request) {
            $rawActor = $request->attributes->get('acting_user') ?? $request->header('X-Acting-User');
            if (is_string($rawActor)) {
                $rawActor = mb_substr(trim($rawActor), 0, 120);
                $actor = $rawActor === '' ? null : $rawActor;
            }
        }

        $requestId = null;
        if ($request instanceof Request) {
            $rawRequestId = $request->attributes->get('request_id') ?? $request->header('X-Request-Id');
            if (is_string($rawRequestId)) {
                $rawRequestId = mb_substr(trim($rawRequestId), 0, 64);
                $requestId = $rawRequestId === '' ? null : $rawRequestId;
            }
        }

        $safeMessage = $this->scrubSecret($message, $request);
        $safeContext = $this->sanitizeContext($context, $request);

        try {
            return AppLog::query()->create([
                'occurred_at' => now()->utc(),
                'level' => $level,
                'message' => $safeMessage,
                'actor' => $actor,
                'request_id' => $requestId,
                'context' => $safeContext,
            ]);
        } catch (Throwable) {
            // Fail silently without throwing to avoid masking original exceptions
            return new AppLog([
                'occurred_at' => now()->utc(),
                'level' => $level,
                'message' => $safeMessage,
            ]);
        }
    }

    /**
     * @param  array<string, mixed>|null  $context
     */
    public function info(string $message, ?array $context = null, ?Request $request = null): AppLog
    {
        return $this->log('info', $message, $context, $request);
    }

    /**
     * @param  array<string, mixed>|null  $context
     */
    public function warn(string $message, ?array $context = null, ?Request $request = null): AppLog
    {
        return $this->log('warn', $message, $context, $request);
    }

    /**
     * @param  array<string, mixed>|null  $context
     */
    public function error(string $message, ?array $context = null, ?Request $request = null): AppLog
    {
        return $this->log('error', $message, $context, $request);
    }

    /**
     * @param  array<string, mixed>|null  $context
     */
    public function debug(string $message, ?array $context = null, ?Request $request = null): AppLog
    {
        return $this->log('debug', $message, $context, $request);
    }

    private function scrubSecret(string $value, ?Request $request): string
    {
        $secrets = array_filter([
            (string) config('gudang.service_key', ''),
            $request instanceof Request ? (string) $request->header('X-Service-Key', '') : '',
        ], fn (string $secret): bool => $secret !== '');

        foreach (array_unique($secrets) as $secret) {
            $value = str_replace($secret, '[REDACTED]', $value);
        }

        return $value;
    }

    /**
     * @param  array<string, mixed>|null  $context
     * @return array<string, mixed>|null
     */
    private function sanitizeContext(?array $context, ?Request $request): ?array
    {
        if ($context === null) {
            return null;
        }

        $sanitized = [];
        $sensitiveKeys = ['password', 'service_key', 'x-service-key', 'secret', 'authorization', 'token', 'key'];

        foreach ($context as $key => $value) {
            if (in_array(strtolower((string) $key), $sensitiveKeys, true)) {
                $sanitized[$key] = '[REDACTED]';
            } elseif (is_array($value)) {
                $sanitized[$key] = $this->sanitizeContext($value, $request);
            } elseif (is_string($value)) {
                $sanitized[$key] = $this->scrubSecret($value, $request);
            } else {
                $sanitized[$key] = $value;
            }
        }

        return $sanitized;
    }
}
