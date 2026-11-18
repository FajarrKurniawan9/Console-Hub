<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property int $process_id
 * @property string $status
 * @property array<string, mixed> $input
 * @property int|null $triggered_by
 * @property string|null $retry_of
 * @property string|null $error_summary
 * @property Carbon|null $started_at
 * @property Carbon|null $finished_at
 * @property Carbon $created_at
 */
#[Fillable(['process_id', 'status', 'input', 'triggered_by', 'retry_of', 'error_summary', 'started_at', 'finished_at'])]
class ProcessRun extends Model
{
    use HasUuids;

    public const FINAL_STATUSES = ['succeeded', 'failed', 'canceled'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'input' => 'array',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    public function isFinal(): bool
    {
        return in_array($this->status, self::FINAL_STATUSES, true);
    }

    /**
     * @return BelongsTo<Process, $this>
     */
    public function process(): BelongsTo
    {
        return $this->belongsTo(Process::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function triggeredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'triggered_by');
    }

    /**
     * @return HasMany<RunStep, $this>
     */
    public function steps(): HasMany
    {
        return $this->hasMany(RunStep::class, 'run_id')->orderBy('position');
    }
}
