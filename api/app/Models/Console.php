<?php

namespace App\Models;

use Database\Factories\ConsoleFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $slug
 * @property string $name
 * @property string $base_url
 * @property string $auth_type
 * @property array<string, mixed> $credentials
 * @property array<string, mixed> $config
 * @property string $timezone
 * @property bool $is_active
 * @property string $status
 * @property int|null $last_latency_ms
 * @property Carbon|null $last_checked_at
 */
#[Fillable(['slug', 'name', 'base_url', 'auth_type', 'credentials', 'config', 'timezone', 'is_active', 'status', 'last_latency_ms', 'last_checked_at'])]
#[Hidden(['credentials'])]
class Console extends Model
{
    /** @use HasFactory<ConsoleFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'credentials' => 'encrypted:array',
            'config' => 'array',
            'is_active' => 'boolean',
            'last_latency_ms' => 'integer',
            'last_checked_at' => 'datetime',
        ];
    }

    /**
     * @return HasOne<LogSyncState, $this>
     */
    public function syncState(): HasOne
    {
        return $this->hasOne(LogSyncState::class);
    }

    /**
     * @return HasOne<ConsoleHealthCheck, $this>
     */
    public function latestHealthCheck(): HasOne
    {
        return $this->hasOne(ConsoleHealthCheck::class)->latestOfMany('checked_at');
    }

    /**
     * @return HasMany<ConsoleHealthCheck, $this>
     */
    public function healthChecks(): HasMany
    {
        return $this->hasMany(ConsoleHealthCheck::class);
    }

    /**
     * Read a value from the connector config using dot notation.
     */
    public function setting(string $key, mixed $default = null): mixed
    {
        return data_get($this->config, $key, $default);
    }
}
