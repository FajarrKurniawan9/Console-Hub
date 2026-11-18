<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $process_id
 * @property int $position
 * @property string $name
 * @property int $console_id
 * @property string $method
 * @property string $path
 * @property array<string, mixed>|null $body_template
 * @property list<int> $expect_status
 * @property int $timeout_seconds
 * @property int $max_retries
 * @property string $on_failure
 * @property array{method: string, path: string, body?: mixed}|null $compensation
 */
#[Fillable(['process_id', 'position', 'name', 'console_id', 'method', 'path', 'body_template', 'expect_status', 'timeout_seconds', 'max_retries', 'on_failure', 'compensation'])]
class ProcessStep extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'body_template' => 'array',
            'expect_status' => 'array',
            'timeout_seconds' => 'integer',
            'max_retries' => 'integer',
            'compensation' => 'array',
        ];
    }

    /**
     * @return BelongsTo<Process, $this>
     */
    public function process(): BelongsTo
    {
        return $this->belongsTo(Process::class);
    }

    /**
     * @return BelongsTo<Console, $this>
     */
    public function console(): BelongsTo
    {
        return $this->belongsTo(Console::class);
    }
}
