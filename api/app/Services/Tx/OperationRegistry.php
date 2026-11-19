<?php

namespace App\Services\Tx;

use App\Services\Tx\Operations\DivisionOperation;
use App\Services\Tx\Operations\EmployeeOperation;
use App\Services\Tx\Operations\ItemOperation;
use App\Services\Tx\Operations\Operation;
use App\Services\Tx\Operations\OrderOperation;
use InvalidArgumentException;

/**
 * Operation name (`karyawan.create`) → the class that builds its payload.
 */
class OperationRegistry
{
    /** @var array<string, class-string<Operation>> */
    private const ENTITIES = [
        'divisi' => DivisionOperation::class,
        'karyawan' => EmployeeOperation::class,
        'barang' => ItemOperation::class,
        'pesanan' => OrderOperation::class,
    ];

    /** @var array<string, list<string>> */
    private const ACTIONS = [
        'divisi' => ['create', 'update', 'deactivate'],
        'karyawan' => ['create', 'update', 'deactivate'],
        'barang' => ['create', 'update', 'deactivate'],
        'pesanan' => ['create', 'complete', 'cancel'],
    ];

    public function __construct(private PayloadBuilder $builder, private CodeGenerator $codes) {}

    public function get(string $name): Operation
    {
        [$entity, $action] = array_pad(explode('.', $name, 2), 2, '');

        if (! isset(self::ENTITIES[$entity]) || ! in_array($action, self::ACTIONS[$entity], true)) {
            throw new InvalidArgumentException("Operasi tidak dikenal: {$name}");
        }

        $class = self::ENTITIES[$entity];

        return new $class($this->builder, $this->codes, $action);
    }
}
