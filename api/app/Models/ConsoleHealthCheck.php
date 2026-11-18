<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $console_id
 * @property string $status
 * @property int|null $latency_ms
 * @property string|null $message
 * @property Carbon $checked_at
 */
#[Fillable(['console_id', 'status', 'latency_ms', 'message', 'checked_at'])]
class ConsoleHealthCheck extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'latency_ms' => 'integer',
            'checked_at' => 'datetime',
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
