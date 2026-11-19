<?php

namespace App\Services\Tx\Operations;

use App\Services\Tx\CodeGenerator;
use App\Services\Tx\PayloadBuilder;
use App\Services\Tx\PreparedTx;
use Illuminate\Support\Str;

/**
 * divisi.create | divisi.update | divisi.deactivate — payload {entity:{id,code,name,status}, expected_version?}
 */
class DivisionOperation implements Operation
{
    public const FIELDS = ['id', 'code', 'name', 'status'];

    /**
     * @param  'create'|'update'|'deactivate'  $action
     */
    public function __construct(private PayloadBuilder $builder, private CodeGenerator $codes, private string $action) {}

    public function name(): string
    {
        return "divisi.{$this->action}";
    }

    public function entityType(): string
    {
        return 'divisi';
    }

    public function creates(): bool
    {
        return $this->action === 'create';
    }

    public function prepare(array $input, ?string $targetId): PreparedTx
    {
        if ($this->action === 'create') {
            $entity = [
                'id' => (string) Str::uuid(),
                // The form asks for a code; the counter is the fallback when none is given.
                'code' => strtoupper((string) ($input['kode'] ?? '')) ?: $this->codes->division(),
                'name' => (string) $input['nama'],
                'status' => 'aktif',
            ];

            return $this->builder->finish($entity, 1, ['entity' => $entity], "{$entity['code']} {$entity['name']}");
        }

        $expected = (int) $input['expected_version'];
        $old = $this->builder->current('divisions', (string) $targetId, self::FIELDS, $expected);
        $entity = $this->action === 'update'
            ? [...$old, ...array_filter(['code' => isset($input['kode']) ? strtoupper((string) $input['kode']) : null, 'name' => $input['nama'] ?? null], fn ($v) => $v !== null)]
            : [...$old, 'status' => 'nonaktif'];

        return $this->builder->finish($entity, $expected + 1, ['entity' => $entity, 'expected_version' => $expected], "{$entity['code']} {$entity['name']}", $old);
    }
}
