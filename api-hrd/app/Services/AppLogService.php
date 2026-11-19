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

        $actor = $request instanceof Request ? $request->header('X-Acting-User') : null;
        if (is_string($actor)) {
            $actor = mb_substr(trim($actor), 0, 120);
            if ($actor === '') {
                $actor = null;
            }
        } else {
            $actor = null;
        }

        $requestId = $request instanceof Request ? $request->header('X-Request-Id') : null;
        if (is_string($requestId)) {
            $requestId = mb_substr(trim($requestId), 0, 64);
            if ($requestId === '') {
                $requestId = null;
            }
        } else {
            $requestId = null;
        }

        $safeContext = $this->sanitizeContext($context);

        try {
            return AppLog::query()->create([
                'occurred_at' => now()->utc(),
                'level' => $level,
                'message' => $message,
                'actor' => $actor,
                'request_id' => $requestId,
                'context' => $safeContext,
            ]);
        } catch (Throwable) {
            // Fail silently or fallback without throwing to avoid masking original exceptions
            return new AppLog([
                'occurred_at' => now()->utc(),
                'level' => $level,
                'message' => $message,
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

    /**
     * @param  array<string, mixed>|null  $context
     * @return array<string, mixed>|null
     */
    private function sanitizeContext(?array $context): ?array
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
                $sanitized[$key] = $this->sanitizeContext($value);
            } else {
                $sanitized[$key] = $value;
            }
        }

        return $sanitized;
    }
}
