<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Composite key (tx_id, console_id): always update through `forParticipant()` scopes, not save().
 *
 * @property string $tx_id
 * @property int $console_id
 * @property string $prepare_state
 * @property string $decision_state
 * @property string|null $refusal_code
 * @property string|null $refusal_message
 * @property int $attempts
 * @property string|null $last_error
 * @property int|null $latency_ms
 * @property int|null $version
 * @property Carbon|null $prepared_at
 * @property Carbon|null $finished_at
 * @property-read Console $console
 */
#[Fillable(['tx_id', 'console_id', 'prepare_state', 'decision_state', 'refusal_code', 'refusal_message', 'attempts', 'last_error', 'latency_ms', 'version', 'prepared_at', 'finished_at'])]
class TransactionParticipant extends Model
{
    public $incrementing = false;

    public $timestamps = false;

    protected $primaryKey = 'tx_id';

    protected $keyType = 'string';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'attempts' => 'integer',
            'latency_ms' => 'integer',
            'version' => 'integer',
            'prepared_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    /**
     * Make save() target this one row instead of every participant of the transaction.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    protected function setKeysForSaveQuery($query): Builder
    {
        return $query->where('tx_id', $this->getOriginal('tx_id') ?? $this->tx_id)
            ->where('console_id', $this->getOriginal('console_id') ?? $this->console_id);
    }

    /**
     * @return BelongsTo<Console, $this>
     */
    public function console(): BelongsTo
    {
        return $this->belongsTo(Console::class);
    }

    /**
     * @return BelongsTo<Transaction, $this>
     */
    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'tx_id');
    }
}
