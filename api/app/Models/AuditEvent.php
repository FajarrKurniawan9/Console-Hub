<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int|null $user_id
 * @property string $action
 * @property string|null $target_type
 * @property string|null $target_id
 * @property int|null $console_id
 * @property array<string, mixed>|null $details
 * @property string|null $ip
 * @property Carbon $created_at
 */
#[Fillable(['user_id', 'action', 'target_type', 'target_id', 'console_id', 'details', 'ip'])]
class AuditEvent extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'details' => 'array',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Console, $this>
     */
    public function console(): BelongsTo
    {
        return $this->belongsTo(Console::class);
    }
}
