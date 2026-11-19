<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $entity_type
 * @property string $status
 * @property int $checked_count
 * @property int $drift_count
 * @property int|null $triggered_by
 * @property Carbon $started_at
 * @property Carbon|null $finished_at
 */
#[Fillable(['entity_type', 'status', 'checked_count', 'drift_count', 'triggered_by', 'started_at', 'finished_at'])]
class ConsistencyCheck extends Model
{
    public $timestamps = false;

    /** Entities replicated to every console (orders are owned by Produksi only). */
    public const ENTITY_TYPES = ['divisi', 'karyawan', 'barang'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'checked_count' => 'integer',
            'drift_count' => 'integer',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    /**
     * @return HasMany<ConsistencyFinding, $this>
     */
    public function findings(): HasMany
    {
        return $this->hasMany(ConsistencyFinding::class, 'check_id');
    }
}
