<?php

namespace App\Http\Requests;

use App\Models\ReportExport;
use Cron\CronExpression;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use Throwable;

class ReportExportStoreRequest extends FormRequest
{
    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', 'string', Rule::in(ReportExport::TYPES)],
            'format' => ['nullable', 'string', Rule::in(ReportExport::FORMATS)],
            'name' => ['nullable', 'string', 'max:160'],
            'filters' => ['nullable', 'array'],
            'scheduled_at' => ['nullable', 'date'],
            'cron_expression' => ['nullable', 'string', 'max:64'],
            'schedule_preset' => ['nullable', 'string', Rule::in(ReportExport::SCHEDULE_PRESETS)],
            'schedule_time' => ['nullable', 'date_format:H:i'],
            'schedule_day_of_week' => ['nullable', 'integer', 'min:0', 'max:6'],
            'schedule_day_of_month' => ['nullable', 'integer', 'min:1', 'max:28'],
            'timezone' => ['nullable', 'timezone:all'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $hasScheduledAt = $this->filled('scheduled_at');
            $hasCron = $this->filled('cron_expression');
            $hasPreset = $this->filled('schedule_preset');

            $modes = (int) $hasScheduledAt + (int) $hasCron + (int) $hasPreset;

            if ($modes > 1) {
                $validator->errors()->add('scheduled_at', 'Pilih salah satu saja: scheduled_at, schedule_preset, atau cron_expression.');

                return;
            }

            if ($hasScheduledAt) {
                try {
                    $at = Carbon::parse((string) $this->input('scheduled_at'))->utc();
                    if (! $at->isFuture()) {
                        $validator->errors()->add('scheduled_at', 'Waktu jadwal ekspor harus di masa depan.');
                    }
                } catch (Throwable) {
                    $validator->errors()->add('scheduled_at', 'Format tanggal jadwal tidak valid.');
                }
            }

            if ($hasCron) {
                $expr = preg_replace('/\s+/', ' ', trim((string) $this->input('cron_expression'))) ?? '';
                if ($expr === '' || ! CronExpression::isValidExpression($expr)) {
                    $validator->errors()->add('cron_expression', 'Ekspresi cron 5-field tidak valid (contoh: "0 8 * * *").');
                }
            }
        });
    }
}
