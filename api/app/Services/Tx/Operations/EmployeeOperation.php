<?php

namespace App\Services\Tx\Operations;

use App\Services\Tx\CodeGenerator;
use App\Services\Tx\PayloadBuilder;
use App\Services\Tx\PreparedTx;
use Illuminate\Support\Str;

/**
 * karyawan.create | karyawan.update | karyawan.deactivate
 * — payload {entity:{id,nik,name,division_id,position,status}, area?, team?, expected_version?}
 */
class EmployeeOperation implements Operation
{
    public const FIELDS = ['id', 'nik', 'name', 'division_id', 'position', 'status'];

    /**
     * @param  'create'|'update'|'deactivate'  $action
     */
    public function __construct(private PayloadBuilder $builder, private CodeGenerator $codes, private string $action) {}

    public function name(): string
    {
        return "karyawan.{$this->action}";
    }

    public function entityType(): string
    {
        return 'karyawan';
    }

    public function creates(): bool
    {
        return $this->action === 'create';
    }

    public function prepare(array $input, ?string $targetId): PreparedTx
    {
        // Area (Gudang access) and team (Produksi) are not shared data, so they sit beside the entity.
        $extra = array_filter(['area' => $input['area'] ?? null, 'team' => $input['team'] ?? null], fn ($v) => $v !== null && $v !== '');

        if ($this->action === 'create') {
            $entity = [
                'id' => (string) Str::uuid(),
                'nik' => $this->codes->employee(),
                'name' => (string) $input['name'],
                'division_id' => (string) $input['division_id'],
                'position' => isset($input['position']) && $input['position'] !== '' ? (string) $input['position'] : null,
                'status' => 'aktif',
            ];

            return $this->builder->finish($entity, 1, ['entity' => $entity, ...$extra], "{$entity['nik']} {$entity['name']}");
        }

        $expected = (int) $input['expected_version'];
        $old = $this->builder->current('employees', (string) $targetId, self::FIELDS, $expected);
        $changes = array_intersect_key($input, array_flip(['name', 'division_id', 'position']));
        $entity = $this->action === 'update' ? [...$old, ...$changes] : [...$old, 'status' => 'nonaktif'];

        return $this->builder->finish($entity, $expected + 1, ['entity' => $entity, ...$extra, 'expected_version' => $expected], "{$entity['nik']} {$entity['name']}", $old);
    }
}
