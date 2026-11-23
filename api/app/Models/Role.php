<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $code
 * @property string $name
 */
#[Fillable(['code', 'name'])]
class Role extends Model
{
    public const ADMIN_IT = 'admin_it';

    public const USER = 'user';

    public const MANAJER_GUDANG = 'manajer_gudang';

    public const STAFF_PRODUKSI = 'staff_produksi';

    public const STAFF_HR = 'staff_hr';

    public const AUDITOR = 'auditor';

    public $timestamps = false;

    /**
     * @return BelongsToMany<Permission, $this>
     */
    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'role_permissions');
    }

    /**
     * @return HasMany<User, $this>
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
