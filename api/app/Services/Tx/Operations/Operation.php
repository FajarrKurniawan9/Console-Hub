<?php

namespace App\Services\Tx\Operations;

use App\Services\Tx\PreparedTx;

interface Operation
{
    /** e.g. `karyawan.create` */
    public function name(): string;

    /** `divisi` | `karyawan` | `barang` | `pesanan` */
    public function entityType(): string;

    public function creates(): bool;

    /**
     * Read the owner when needed, check `expected_version`, build the payload.
     * Throws ApiException (404, 409 VERSION_CONFLICT, 422) before any transaction row exists.
     *
     * @param  array<string, mixed>  $input  request fields, frontend names
     */
    public function prepare(array $input, ?string $targetId): PreparedTx;
}
