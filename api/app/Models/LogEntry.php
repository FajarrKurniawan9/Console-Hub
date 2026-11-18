<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $console_id
 * @property Carbon $occurred_at
 * @property string $level
 * @property string $message
 * @property string|null $actor
 * @property string $dedupe_key
 * @property array<string, mixed>|null $raw
 * @property Carbon $ingested_at
 */
#[Fillable(['console_id', 'occurred_at', 'level', 'message', 'actor', 'dedupe_key', 'raw', 'ingested_at'])]
class LogEntry extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'occurred_at' => 'datetime',
            'ingested_at' => 'datetime',
            'raw' => 'array',
        ];
    }

    /**
     * @return BelongsTo<Console, $this>
     */
    public function console(): BelongsTo
    {
        return $this->belongsTo(Console::class);
    }
}
