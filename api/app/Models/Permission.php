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
     * Every permission code with a short description (brief v3 section 6).
     *
     * @var array<string, string>
     */
    public const ALL = [
        'karyawan.view' => 'Melihat karyawan',
        'karyawan.create' => 'Menambah karyawan',
        'karyawan.update' => 'Mengubah karyawan',
        'karyawan.delete' => 'Menonaktifkan karyawan',
        'divisi.view' => 'Melihat divisi',
        'divisi.create' => 'Menambah divisi',
        'divisi.update' => 'Mengubah divisi',
        'divisi.delete' => 'Menonaktifkan divisi',
        'barang.view' => 'Melihat barang',
        'barang.create' => 'Menambah barang',
        'barang.update' => 'Mengubah barang',
        'barang.delete' => 'Menonaktifkan barang',
        'pesanan.view' => 'Melihat pesanan',
        'pesanan.create' => 'Membuat pesanan',
        'pesanan.complete' => 'Menyelesaikan pesanan',
        'pesanan.cancel' => 'Membatalkan pesanan',
        'admin.dashboard.view' => 'Melihat ringkasan admin',
        'admin.logs.view' => 'Melihat dan menarik log gabungan',
        'admin.consoles.view' => 'Melihat dan menguji console',
        'admin.consoles.manage' => 'Mengelola konfigurasi console',
        'admin.transactions.view' => 'Melihat transaksi',
        'admin.transactions.resolve' => 'Menyelesaikan transaksi bermasalah',
        'admin.consistency.view' => 'Melihat hasil pemeriksaan konsistensi',
        'admin.consistency.repair' => 'Menjalankan pemeriksaan dan perbaikan konsistensi',
        'admin.rbac.manage' => 'Mengelola pengguna, peran, dan izin',
        'admin.audit.view' => 'Melihat catatan audit',
    ];

    /**
     * Default permissions of the `user` role.
     *
     * @var list<string>
     */
    public const USER_DEFAULTS = [
        'karyawan.view', 'karyawan.create', 'karyawan.update',
        'divisi.view',
        'barang.view', 'barang.create', 'barang.update',
        'pesanan.view', 'pesanan.create', 'pesanan.complete', 'pesanan.cancel',
    ];
}
