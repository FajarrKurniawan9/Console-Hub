<?php

namespace App\Models;

use Database\Factories\ConsoleFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * A console reached only through its internal HTTP API. `service_key` is encrypted and never serialised.
 *
 * @property int $id
 * @property string $slug
 * @property string $name
 * @property string $base_url
 * @property string $auth_type
 * @property string|null $service_key
 * @property bool $is_active
 * @property list<string> $is_owner_of
 */
#[Fillable(['slug', 'name', 'base_url', 'auth_type', 'service_key', 'is_active', 'is_owner_of'])]
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
     * Postgres TEXT[] <-> PHP list.
     *
     * @return Attribute<list<string>, list<string>>
     */
    protected function isOwnerOf(): Attribute
    {
        return Attribute::make(
            get: fn (?string $value) => $value === null || $value === '{}' ? [] : array_values(array_filter(explode(',', trim($value, '{}')))),
            set: fn (array $value) => '{'.implode(',', array_map(fn (string $v) => preg_replace('/[^a-z_]/', '', $v), $value)).'}',
        );
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
     * @return HasOne<ConsoleHealthCheck, $this>
     */
    public function latestHealthCheck(): HasOne
    {
        return $this->hasOne(ConsoleHealthCheck::class)->latestOfMany('checked_at');
    }
}
