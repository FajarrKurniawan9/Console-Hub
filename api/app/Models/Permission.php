<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $code
 * @property string|null $description
 */
#[Fillable(['code', 'description'])]
class Permission extends Model
{
    public $timestamps = false;

    /**
     * Every permission code with a short description (update 1 section 4).
     *
     * @var array<string, string>
     */
    public const ALL = [
        'barang.view' => 'Melihat barang',
        'barang.create' => 'Menambah barang',
        'barang.update' => 'Mengubah barang',
        'barang.delete' => 'Menonaktifkan barang',
        'produksi.view' => 'Melihat produksi',
        'produksi.create' => 'Menambah produksi',
        'produksi.update' => 'Mengubah produksi',
        'produksi.delete' => 'Menonaktifkan produksi',
        'personel.view' => 'Melihat personel',
        'personel.create' => 'Menambah personel',
        'personel.update' => 'Mengubah personel',
        'personel.delete' => 'Menonaktifkan personel',
        'lacak.view' => 'Melacak barang',
        'admin.dashboard.view' => 'Melihat ringkasan admin',
        'admin.logs.view' => 'Melihat dan menarik log gabungan',
        'admin.consoles.view' => 'Melihat dan menguji sumber data',
        'admin.consoles.manage' => 'Mengelola registri sumber data',
        'admin.rbac.manage' => 'Mengelola pengguna, peran, dan izin',
        'admin.audit.view' => 'Melihat catatan audit',
    ];

    /**
     * Default permissions of the `user` role.
     *
     * @var list<string>
     */
    public const USER_DEFAULTS = [
        'barang.view', 'barang.create', 'barang.update',
        'produksi.view', 'produksi.create', 'produksi.update',
        'personel.view',
        'lacak.view',
    ];
}
