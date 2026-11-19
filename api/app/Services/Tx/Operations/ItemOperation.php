<?php

namespace App\Services\Tx\Operations;

use App\Services\Tx\CodeGenerator;
use App\Services\Tx\PayloadBuilder;
use App\Services\Tx\PreparedTx;
use Illuminate\Support\Str;

/**
 * barang.create | barang.update | barang.deactivate
 * — payload {entity:{id,sku,name,kind:"BB"|"BJ",unit,price,min_stock,pic_id,status}, expected_version?}
 */
class ItemOperation implements Operation
{
    public const FIELDS = ['id', 'sku', 'name', 'kind', 'unit', 'price', 'min_stock', 'pic_id', 'status'];

    /** Frontend field => console field. */
    private const MAP = ['nama' => 'name', 'satuan' => 'unit', 'min_stock' => 'min_stock', 'harga_jual_idr' => 'price', 'pic_employee_id' => 'pic_id'];

    /**
     * @param  'create'|'update'|'deactivate'  $action
     */
    public function __construct(private PayloadBuilder $builder, private CodeGenerator $codes, private string $action) {}

    public function name(): string
    {
        return "barang.{$this->action}";
    }

    public function entityType(): string
    {
        return 'barang';
    }

    public function creates(): bool
    {
        return $this->action === 'create';
    }

    public function prepare(array $input, ?string $targetId): PreparedTx
    {
        if ($this->action === 'create') {
            $kind = $input['jenis'] === 'barang_jadi' ? 'BJ' : 'BB';
            $entity = [
                'id' => (string) Str::uuid(),
                'sku' => $this->codes->item($kind),
                'name' => (string) $input['nama'],
                'kind' => $kind,
                'unit' => (string) $input['satuan'],
                // Only finished goods have a selling price.
                'price' => $kind === 'BJ' && isset($input['harga_jual_idr']) ? (int) $input['harga_jual_idr'] : null,
                'min_stock' => (int) $input['min_stock'],
                'pic_id' => $input['pic_employee_id'] ?? null,
                'status' => 'aktif',
            ];

            return $this->builder->finish($entity, 1, ['entity' => $entity], "{$entity['sku']} {$entity['name']}");
        }

        $expected = (int) $input['expected_version'];
        $old = $this->builder->current('items', (string) $targetId, self::FIELDS, $expected);
        $entity = [...$old];

        if ($this->action === 'update') {
            foreach (self::MAP as $from => $to) {
                if (array_key_exists($from, $input)) {
                    $entity[$to] = match ($to) {
                        'min_stock' => (int) $input[$from],
                        'price' => $entity['kind'] === 'BJ' && $input[$from] !== null ? (int) $input[$from] : null,
                        default => $input[$from],
                    };
                }
            }
        } else {
            $entity['status'] = 'nonaktif';
        }

        return $this->builder->finish($entity, $expected + 1, ['entity' => $entity, 'expected_version' => $expected], "{$entity['sku']} {$entity['name']}", $old);
    }
}
