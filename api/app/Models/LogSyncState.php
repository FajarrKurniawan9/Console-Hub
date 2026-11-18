<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $console_id
 * @property array<string, mixed> $cursor
 * @property Carbon|null $last_synced_at
 * @property Carbon|null $last_success_at
 * @property string|null $last_error
 */
#[Fillable(['console_id', 'cursor', 'last_synced_at', 'last_success_at', 'last_error'])]
class LogSyncState extends Model
{
    protected $table = 'log_sync_state';

    protected $primaryKey = 'console_id';

    public $incrementing = false;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'cursor' => 'array',
            'last_synced_at' => 'datetime',
            'last_success_at' => 'datetime',
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
