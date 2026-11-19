<?php

use App\Services\Tx\Checksum;
use App\Services\Tx\CodeGenerator;

it('makes the checksum independent of key order and record fields', function () {
    $a = ['id' => 'x', 'name' => 'Rina', 'meta' => ['b' => 2, 'a' => 1], 'version' => 3, 'checksum' => 'old', 'locked_by_tx' => 'y'];
    $b = ['meta' => ['a' => 1, 'b' => 2], 'name' => 'Rina', 'id' => 'other', 'version' => 9, 'updated_at' => 'now'];

    expect(Checksum::of($a))->toBe(Checksum::of($b))
        ->toBe(sha1('{"meta":{"a":1,"b":2},"name":"Rina"}'))
        ->not->toBe(Checksum::of([...$b, 'name' => 'Rina W']));
});

it('keeps list order and unicode in the canonical json', function () {
    expect(Checksum::canonical(['lines' => [['qty' => 2, 'sku' => 'B'], ['qty' => 1, 'sku' => 'A']], 'nama' => 'Bolu pandan / 22 cm']))
        ->toBe('{"lines":[{"qty":2,"sku":"B"},{"qty":1,"sku":"A"}],"nama":"Bolu pandan / 22 cm"}');
});

it('generates business codes from counters without resetting them', function () {
    $codes = app(CodeGenerator::class);
    $codes->bump('employee', 12);
    $codes->bump('employee', 3);

    expect($codes->employee())->toBe('E-0013')
        ->and($codes->employee())->toBe('E-0014')
        ->and($codes->division())->toBe('DIV-01')
        ->and($codes->item('BB'))->toBe('SKU-BB-001')
        ->and($codes->item('BJ'))->toBe('SKU-BJ-001')
        ->and($codes->order())->toBe('PO-'.now()->year.'-0001');
});
