<?php

namespace App\Connectors;

use App\Models\Console;
use Carbon\CarbonImmutable;
use Throwable;

/**
 * Normalises raw console log entries into the portal's uniform shape using logs.map.
 */
class LogMapper
{
    public const LEVELS = ['debug', 'info', 'warn', 'error'];

    /**
     * @param  array<string, mixed>  $entry
     * @return array{occurred_at: CarbonImmutable, level: string, message: string, actor: string|null, raw: array<string, mixed>}|null
     */
    public function map(Console $console, array $entry): ?array
    {
        $map = (array) $console->setting('logs.map', []);
        $occurredAt = $this->time($entry, (array) ($map['occurred_at'] ?? []), $console->timezone);

        if ($occurredAt === null) {
            return null;
        }

        $actor = data_get($entry, $map['actor']['field'] ?? 'actor');

        return [
            'occurred_at' => $occurredAt,
            'level' => $this->level($entry, (array) ($map['level'] ?? [])),
            'message' => (string) data_get($entry, $map['message']['field'] ?? 'message', ''),
            'actor' => $actor === null || $actor === '' ? null : (string) $actor,
            'raw' => $entry,
        ];
    }

    public static function dedupeKey(int $consoleId, CarbonImmutable $occurredAt, string $message): string
    {
        return sha1($consoleId.'|'.$occurredAt->utc()->format('Y-m-d\TH:i:s.u\Z').'|'.$message);
    }

    /**
     * @param  array<string, mixed>  $entry
     * @param  array{field?: string, format?: string}  $rule
     */
    private function time(array $entry, array $rule, string $timezone): ?CarbonImmutable
    {
        $value = data_get($entry, $rule['field'] ?? 'timestamp');
        $format = $rule['format'] ?? 'iso8601';

        if ($value === null || $value === '') {
            return null;
        }

        try {
            $time = match ($format) {
                'iso8601' => CarbonImmutable::parse((string) $value, $timezone),
                'epoch_seconds' => CarbonImmutable::createFromTimestamp((float) $value, 'UTC'),
                'epoch_millis' => CarbonImmutable::createFromTimestampMs((float) $value, 'UTC'),
                default => CarbonImmutable::createFromFormat($format, (string) $value, $timezone) ?: null,
            };
        } catch (Throwable) {
            return null;
        }

        return $time?->utc();
    }

    /**
     * @param  array<string, mixed>  $entry
     * @param  array{field?: string, values?: array<string, string>}  $rule
     */
    private function level(array $entry, array $rule): string
    {
        $value = strtolower((string) data_get($entry, $rule['field'] ?? 'level', ''));

        foreach ($rule['values'] ?? [] as $original => $level) {
            if (strtolower((string) $original) === $value && in_array($level, self::LEVELS, true)) {
                return $level;
            }
        }

        return in_array($value, self::LEVELS, true) ? $value : 'info';
    }
}
