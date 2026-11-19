<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $check_id
 * @property string $entity_type
 * @property string $entity_id
 * @property int $console_id
 * @property string $kind
 * @property int|null $owner_version
 * @property int|null $console_version
 * @property Carbon|null $repaired_at
 * @property-read Console $console
 */
#[Fillable(['check_id', 'entity_type', 'entity_id', 'console_id', 'kind', 'owner_version', 'console_version', 'repaired_at'])]
class ConsistencyFinding extends Model
{
    public $timestamps = false;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'owner_version' => 'integer',
            'console_version' => 'integer',
            'repaired_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<ConsistencyCheck, $this>
     */
    public function check(): BelongsTo
    {
        return $this->belongsTo(ConsistencyCheck::class, 'check_id');
    }

    /**
     * @return BelongsTo<Console, $this>
     */
    public function console(): BelongsTo
    {
        return $this->belongsTo(Console::class);
    }
}
