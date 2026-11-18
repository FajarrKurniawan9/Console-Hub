<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $run_id
 * @property int|null $process_step_id
 * @property int $position
 * @property string $name
 * @property int|null $console_id
 * @property string $status
 * @property int $attempt
 * @property array{method: string, url: string, body?: mixed}|null $request
 * @property int|null $response_status
 * @property mixed $response_body
 * @property string|null $error
 * @property Carbon|null $started_at
 * @property Carbon|null $finished_at
 * @property int|null $duration_ms
 */
#[Fillable(['run_id', 'process_step_id', 'position', 'name', 'console_id', 'status', 'attempt', 'request', 'response_status', 'response_body', 'error', 'started_at', 'finished_at', 'duration_ms'])]
class RunStep extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'attempt' => 'integer',
            'request' => 'array',
            'response_status' => 'integer',
            'response_body' => 'json',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
            'duration_ms' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<ProcessRun, $this>
     */
    public function run(): BelongsTo
    {
        return $this->belongsTo(ProcessRun::class, 'run_id');
    }

    /**
     * @return BelongsTo<ProcessStep, $this>
     */
    public function processStep(): BelongsTo
    {
        return $this->belongsTo(ProcessStep::class);
    }

    /**
     * @return BelongsTo<Console, $this>
     */
    public function console(): BelongsTo
    {
        return $this->belongsTo(Console::class);
    }
}
