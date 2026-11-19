<?php

namespace App\Services\Tx\Operations;

use App\Services\Tx\CodeGenerator;
use App\Services\Tx\PayloadBuilder;
use App\Services\Tx\PreparedTx;
use App\Support\ApiException;
use Illuminate\Support\Str;

/**
 * pesanan.create — payload {order:{id,code,customer,pic_id,lines:[{item_id,sku,qty}]}}
 * pesanan.complete | pesanan.cancel — payload {order_id, expected_version}
 * The checksum covers the order with its status, so finishing an order changes it.
 */
class OrderOperation implements Operation
{
    public const FIELDS = ['id', 'code', 'customer', 'pic_id', 'lines', 'status'];

    private const NEXT_STATUS = ['complete' => 'SELESAI', 'cancel' => 'DIBATALKAN'];

    /**
     * @param  'create'|'complete'|'cancel'  $action
     */
    public function __construct(private PayloadBuilder $builder, private CodeGenerator $codes, private string $action) {}

    public function name(): string
    {
        return "pesanan.{$this->action}";
    }

    public function entityType(): string
    {
        return 'pesanan';
    }

    public function creates(): bool
    {
        return $this->action === 'create';
    }

    public function prepare(array $input, ?string $targetId): PreparedTx
    {
        if ($this->action === 'create') {
            $order = [
                'id' => (string) Str::uuid(),
                'code' => $this->codes->order(),
                'customer' => (string) $input['customer'],
                'pic_id' => (string) $input['pic_employee_id'],
                'lines' => $this->lines($input['lines']),
            ];

            return $this->builder->finish([...$order, 'status' => 'ANTRE'], 1, ['order' => $order], "{$order['code']} {$order['customer']}");
        }

        $expected = (int) $input['expected_version'];
        $old = $this->builder->current('orders', (string) $targetId, self::FIELDS, $expected);
        $old['lines'] = $this->normalize((array) ($old['lines'] ?? []));
        $entity = [...$old, 'status' => self::NEXT_STATUS[$this->action]];

        return $this->builder->finish($entity, $expected + 1, ['order_id' => $old['id'], 'expected_version' => $expected], "{$old['code']} {$old['customer']}", $old);
    }

    /**
     * Merge duplicate items, look up each SKU at Gudang (the owner of items).
     *
     * @param  list<array{item_id: string, qty: int|numeric-string}>  $lines
     * @return list<array{item_id: string, sku: string, qty: int}>
     */
    private function lines(array $lines): array
    {
        $merged = [];
        $index = [];

        foreach ($lines as $i => $line) {
            $id = (string) $line['item_id'];
            $index[$id] ??= $i;
            $merged[$id] = ($merged[$id] ?? 0) + (int) $line['qty'];
        }

        $result = [];

        foreach ($merged as $id => $qty) {
            try {
                $sku = (string) $this->builder->read('items', $id)['sku'];
            } catch (ApiException $e) {
                if ($e->errorCode === 'NOT_FOUND') {
                    throw ApiException::validation(["lines.{$index[$id]}.item_id" => ['Barang tidak ditemukan.']]);
                }

                throw $e;
            }

            $result[] = ['item_id' => $id, 'sku' => $sku, 'qty' => $qty];
        }

        return $result;
    }

    /**
     * Keep only the shared line fields (Produksi adds names and prices for display).
     *
     * @param  array<int, mixed>  $lines
     * @return list<array{item_id: string, sku: string, qty: int}>
     */
    private function normalize(array $lines): array
    {
        return array_values(array_map(fn ($l) => ['item_id' => (string) $l['item_id'], 'sku' => (string) $l['sku'], 'qty' => (int) $l['qty']], array_filter($lines, 'is_array')));
    }
}
