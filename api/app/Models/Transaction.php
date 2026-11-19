<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * One coordinated write across the consoles (two-phase commit).
 *
 * @property string $id
 * @property string $operation
 * @property string|null $entity_type
 * @property string|null $entity_id
 * @property array<string, mixed> $payload
 * @property string $state
 * @property string $idempotency_key
 * @property int|null $requested_by
 * @property array<string, mixed>|null $result
 * @property string|null $failure_code
 * @property string|null $failure_console
 * @property string|null $failure_message
 * @property Carbon $created_at
 * @property Carbon|null $decided_at
 * @property Carbon|null $finished_at
 */
#[Fillable(['id', 'operation', 'entity_type', 'entity_id', 'payload', 'state', 'idempotency_key', 'requested_by', 'result', 'failure_code', 'failure_console', 'failure_message', 'decided_at', 'finished_at'])]
class Transaction extends Model
{
    use HasUuids;

    public const UPDATED_AT = null;

    public const STATES = ['preparing', 'prepared', 'committing', 'committed', 'aborting', 'aborted', 'needs_attention'];

    /** States after which nothing more happens without an admin. */
    public const FINAL_STATES = ['committed', 'aborted', 'needs_attention'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'result' => 'array',
            'decided_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    /**
     * @return HasMany<TransactionParticipant, $this>
     */
    public function participants(): HasMany
    {
        return $this->hasMany(TransactionParticipant::class, 'tx_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }
}
