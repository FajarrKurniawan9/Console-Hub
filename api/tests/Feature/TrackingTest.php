<?php

use App\Models\Permission;

beforeEach(fn () => fakeSources());

function trackedItem(): array
{
    $sari = FakeSources::add('people', ['name' => 'Sari', 'role' => 'Kepala Gudang']);
    $budi = FakeSources::add('people', ['name' => 'Budi', 'role' => 'Kurir']);
    $tenun = FakeSources::add('productions', ['area' => 'Area Tekstil A', 'production_type' => 'Tenun', 'courier_id' => $budi['id']]);

    return FakeSources::add('items', ['name' => 'Kain katun', 'kind' => 'kain', 'production_id' => $tenun['id'], 'responsible_id' => $sari['id'], 'quantity' => 40, 'unit' => 'm']);
}

it('tracks an item through all three sources', function () {
    actingAsRole('user');
    $item = trackedItem();

    $response = $this->getJson("/api/v1/tracking/items/{$item['id']}")->assertOk();

    expect($response->json('data'))
        ->item->name->toBe('Kain katun')
        ->item->production->area->toBe('Area Tekstil A')
        ->item->responsible->name->toBe('Sari')
        ->production->courier->name->toBe('Budi')
        ->responsible->name->toBe('Sari')
        ->courier->name->toBe('Budi')
        ->warnings->toBe([])
        ->and($response->json())->not->toHaveKey('data.sources');
    expect(array_keys($response->json('data')))->toBe(['item', 'production', 'responsible', 'courier', 'warnings']);
});

it('keeps the other data with a warning when HR is down', function () {
    actingAsRole('admin_it');
    $item = trackedItem();
    FakeSources::$down = ['hr'];

    $this->getJson("/api/v1/tracking/items/{$item['id']}")->assertOk()
        ->assertJsonPath('data.production.area', 'Area Tekstil A')
        ->assertJsonPath('data.responsible', null)
        ->assertJsonPath('data.courier', null)
        ->assertJsonPath('data.warnings', ['Data personel sedang tidak tersedia.'])
        ->assertJsonPath('data.sources.2', ['source' => 'hr', 'status' => 'unavailable', 'latency_ms' => null]);
});

it('warns when Produksi is down and still shows the responsible person', function () {
    actingAsRole('user');
    $item = trackedItem();
    FakeSources::$down = ['produksi'];

    $this->getJson("/api/v1/tracking/items/{$item['id']}")->assertOk()
        ->assertJsonPath('data.production', null)
        ->assertJsonPath('data.item.production', null)
        ->assertJsonPath('data.responsible.name', 'Sari')
        ->assertJsonPath('data.warnings', ['Data produksi sedang tidak tersedia.']);
});

it('answers 502 when Gudang is down and 404 for an unknown item', function () {
    actingAsRole('user');
    assertApiError($this->getJson('/api/v1/tracking/items/'.Str::uuid()), 404, 'NOT_FOUND');

    FakeSources::$down = ['gudang'];
    assertApiError($this->getJson('/api/v1/tracking/items/'.Str::uuid()), 502, 'SOURCE_UNREACHABLE');
});

it('warns when the production reference is not found', function () {
    actingAsRole('admin_it');
    $item = FakeSources::add('items', ['name' => 'Besi', 'kind' => 'besi', 'production_id' => (string) Str::uuid(), 'responsible_id' => null, 'quantity' => 1, 'unit' => 'kg']);

    $this->getJson("/api/v1/tracking/items/{$item['id']}")->assertOk()
        ->assertJsonPath('data.warnings', ['Asal produksi tidak ditemukan.'])
        ->assertJsonPath('data.sources.1.status', 'not_found')
        ->assertJsonPath('data.sources.2', ['source' => 'hr', 'status' => 'ok', 'latency_ms' => null]);
});

it('gives sources to admin.consoles.view only, with both HR calls summed', function () {
    actingAsRole('admin_it');
    $item = trackedItem();

    $sources = $this->getJson("/api/v1/tracking/items/{$item['id']}")->assertOk()->json('data.sources');

    expect(array_column($sources, 'source'))->toBe(['gudang', 'produksi', 'hr'])
        ->and(array_column($sources, 'status'))->toBe(['ok', 'ok', 'ok'])
        ->and($sources[2]['latency_ms'])->toBeInt()
        ->and(FakeSources::calls('hr'))->toHaveCount(2);
});

it('needs lacak.view', function () {
    $user = actingAsRole('user');
    $user->role->permissions()->detach(Permission::query()->where('code', 'lacak.view')->value('id'));
    $user->unsetRelation('role');

    assertApiError($this->getJson('/api/v1/tracking/items/'.Str::uuid()), 403, 'FORBIDDEN');
});
