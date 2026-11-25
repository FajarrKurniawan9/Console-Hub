<?php

namespace App\Services\Reports;

use App\Models\ReportExport;
use Cron\CronExpression;
use Illuminate\Support\Carbon;
use InvalidArgumentException;

/**
 * Resolves immediate, one-time (`scheduled_at`), and recurring (preset or 5-field cron) export schedules.
 */
class ReportScheduleResolver
{
    public const DEFAULT_TIMEZONE = 'Asia/Jakarta';

    public const DEFAULT_TIME = '08:00';

    /**
     * Resolve validated request inputs into normalized schedule columns for `report_exports`.
     *
     * @param  array<string, mixed>  $validated
     * @return array{schedule_type: string, cron_expression: string|null, timezone: string, scheduled_at: Carbon|null}
     */
    public function resolve(array $validated): array
    {
        $timezone = is_string($validated['timezone'] ?? null) && trim($validated['timezone']) !== ''
            ? trim($validated['timezone'])
            : self::DEFAULT_TIMEZONE;

        if (is_string($validated['scheduled_at'] ?? null) && trim($validated['scheduled_at']) !== '') {
            return [
                'schedule_type' => ReportExport::SCHEDULE_ONCE,
                'cron_expression' => null,
                'timezone' => $timezone,
                'scheduled_at' => Carbon::parse($validated['scheduled_at'])->utc(),
            ];
        }

        $cron = null;

        if (is_string($validated['cron_expression'] ?? null) && trim($validated['cron_expression']) !== '') {
            $cron = preg_replace('/\s+/', ' ', trim($validated['cron_expression'])) ?? trim($validated['cron_expression']);
        } elseif (is_string($validated['schedule_preset'] ?? null) && trim($validated['schedule_preset']) !== '') {
            $cron = $this->cronFromPreset(
                trim($validated['schedule_preset']),
                is_string($validated['schedule_time'] ?? null) ? $validated['schedule_time'] : self::DEFAULT_TIME,
                isset($validated['schedule_day_of_week']) ? (int) $validated['schedule_day_of_week'] : 1,
                isset($validated['schedule_day_of_month']) ? (int) $validated['schedule_day_of_month'] : 1,
            );
        }

        if ($cron !== null) {
            return [
                'schedule_type' => ReportExport::SCHEDULE_RECURRING,
                'cron_expression' => $cron,
                'timezone' => $timezone,
                'scheduled_at' => $this->nextRunFromCron($cron, $timezone, now()),
            ];
        }

        return [
            'schedule_type' => ReportExport::SCHEDULE_IMMEDIATE,
            'cron_expression' => null,
            'timezone' => $timezone,
            'scheduled_at' => null,
        ];
    }

    public function cronFromPreset(string $preset, string $time = self::DEFAULT_TIME, int $dayOfWeek = 1, int $dayOfMonth = 1): string
    {
        [$hourStr, $minuteStr] = array_pad(explode(':', trim($time), 2), 2, '0');
        $hour = (int) $hourStr;
        $minute = (int) $minuteStr;

        return match ($preset) {
            'daily' => "{$minute} {$hour} * * *",
            'weekly' => "{$minute} {$hour} * * {$dayOfWeek}",
            'monthly' => "{$minute} {$hour} {$dayOfMonth} * *",
            default => throw new InvalidArgumentException("Preset jadwal tidak dikenal: {$preset}"),
        };
    }

    public function nextRunFromCron(string $cronExpression, string $timezone, Carbon $afterUtc): Carbon
    {
        $cron = new CronExpression($cronExpression);
        $baseLocal = $afterUtc->copy()->setTimezone($timezone);
        $nextLocal = $cron->getNextRunDate($baseLocal, 0, false, $timezone);

        return Carbon::instance($nextLocal)->utc();
    }
}
