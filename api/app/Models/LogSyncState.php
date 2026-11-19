<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $console_id
 * @property Carbon|null $last_synced_at
 * @property string|null $last_cursor
 * @property string|null $last_error
 */
#[Fillable(['console_id', 'last_synced_at', 'last_cursor', 'last_error'])]
class LogSyncState extends Model
{
    protected $table = 'log_sync_state';

    protected $primaryKey = 'console_id';

    public $incrementing = false;

    public $timestamps = false;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'last_synced_at' => 'datetime',
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
