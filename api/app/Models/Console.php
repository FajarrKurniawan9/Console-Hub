<?php

namespace App\Models;

use App\Services\HealthChecker;
use Database\Factories\ConsoleFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * A source API (Gudang, Produksi, HR) reached only over HTTP; it owns one `resource`. `service_key` is encrypted and never serialised.
 *
 * @property int $id
 * @property string $slug
 * @property string $name
 * @property string $base_url
 * @property string $auth_type
 * @property string|null $service_key
 * @property bool $is_active
 * @property 'items'|'productions'|'people' $resource
 */
#[Fillable(['slug', 'name', 'base_url', 'auth_type', 'service_key', 'is_active', 'resource'])]
#[Hidden(['service_key'])]
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
            'service_key' => 'encrypted',
            'is_active' => 'boolean',
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
     * @return HasMany<ConsoleHealthCheck, $this>
     */
    public function healthChecks(): HasMany
    {
        return $this->hasMany(ConsoleHealthCheck::class);
    }

    /**
     * The last few checks (enough to decide "down"); eager load with `withRecentHealth()`.
     *
     * @return HasMany<ConsoleHealthCheck, $this>
     */
    public function recentHealthChecks(): HasMany
    {
        return $this->hasMany(ConsoleHealthCheck::class)->latest('checked_at')->orderByDesc('id');
    }

    /**
     * Eager load the latest checks per console without pulling the whole history.
     *
     * @param  Builder<Console>  $query
     */
    #[Scope]
    protected function withRecentHealth(Builder $query): void
    {
        $query->with(['recentHealthChecks' => fn ($q) => $q->limit(HealthChecker::DOWN_AFTER)]);
    }
}
