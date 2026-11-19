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
 * @property string|null $tx_id
 * @property array<string, mixed>|null $raw
 * @property string $fingerprint
 */
#[Fillable(['console_id', 'occurred_at', 'level', 'message', 'actor', 'tx_id', 'raw', 'fingerprint'])]
class LogEntry extends Model
{
    public $timestamps = false;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'occurred_at' => 'datetime',
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
