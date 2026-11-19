<?php

use App\Models\AuditEvent;
use App\Models\Permission;

beforeEach(fn () => fakeSources());

function person(array $fields = []): array
{
    return FakeSources::add('people', ['name' => 'Sari', 'role' => 'Kurir', ...$fields]);
}

function production(array $fields = []): array
{
    return FakeSources::add('productions', ['area' => 'Area Tekstil A', 'production_type' => 'Tenun', 'courier_id' => null, ...$fields]);
}

function item(array $fields = []): array
{
    return FakeSources::add('items', ['name' => 'Kain katun', 'kind' => 'kain', 'production_id' => null, 'responsible_id' => null, 'quantity' => 10, 'unit' => 'm', ...$fields]);
}

// ---- read and merge

it('lists items merged with one ?ids= call per source', function () {
    actingAsRole('user');
    $sari = person();
    $budi = person(['name' => 'Budi']);
    $tenun = production(['courier_id' => $sari['id']]);
    item(['production_id' => $tenun['id'], 'responsible_id' => $sari['id']]);
    item(['name' => 'Benang', 'responsible_id' => $budi['id']]);
    item(['name' => 'Besi', 'kind' => 'besi']);

    $response = $this->getJson('/api/v1/items')->assertOk();

    $byName = collect($response->json('data'))->keyBy('name');
    expect($byName['Kain katun']['production'])->toBe(['id' => $tenun['id'], 'area' => 'Area Tekstil A', 'production_type' => 'Tenun'])
        ->and($byName['Kain katun']['responsible'])->toBe(['id' => $sari['id'], 'name' => 'Sari', 'role' => 'Kurir'])
        ->and($byName['Benang']['responsible']['name'])->toBe('Budi')
        ->and($byName['Besi']['production'])->toBeNull()
        ->and($response->json('meta'))->toBe(['next_cursor' => null])
        ->and(FakeSources::calls('hr'))->toBe(['GET hr /api/v1/people?ids'])
        ->and(FakeSources::calls('produksi'))->toBe(['GET produksi /api/v1/productions?ids']);
    expect(array_keys($response->json('data.0')))->toBe(['id', 'name', 'kind', 'production_id', 'production', 'responsible_id', 'responsible', 'quantity', 'unit', 'status', 'version', 'created_at', 'updated_at']);
});

it('passes list filters to the owner', function () {
    actingAsRole('user');
    item();
    item(['name' => 'Besi', 'kind' => 'besi']);

    $this->getJson('/api/v1/items?kind=besi')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Besi');
});

it('keeps the list when a merged source is down and names it in meta.unavailable', function () {
    actingAsRole('user');
    item(['responsible_id' => person()['id'], 'production_id' => production()['id']]);
    FakeSources::$down = ['hr'];

    $this->getJson('/api/v1/items')->assertOk()
        ->assertJsonPath('data.0.responsible', null)
        ->assertJsonPath('data.0.production.area', 'Area Tekstil A')
        ->assertJsonPath('meta.unavailable', ['hr']);
});

it('answers 502 when the owner source is down, with an everyday message for User', function () {
    actingAsRole('user');
    FakeSources::$down = ['gudang'];

    $response = $this->getJson('/api/v1/items');

    assertApiError($response, 502, 'SOURCE_UNREACHABLE');
    expect($response->getContent())->not->toContain('gudang')->not->toContain('.test');
    $this->getJson('/api/v1/people')->assertOk();
});

it('merges the courier into a production detail and answers 404 for an unknown id', function () {
    actingAsRole('user');
    $p = production(['courier_id' => person()['id']]);

    $this->getJson("/api/v1/productions/{$p['id']}")->assertOk()->assertJsonPath('data.courier.name', 'Sari');
    assertApiError($this->getJson('/api/v1/productions/'.Str::uuid()), 404, 'NOT_FOUND');
});

it('shows a merged part as null when the reference is not found in its source', function () {
    actingAsRole('user');
    item(['responsible_id' => (string) Str::uuid()]);

    $this->getJson('/api/v1/items')->assertOk()->assertJsonPath('data.0.responsible', null)->assertJsonMissingPath('meta.unavailable');
});

// ---- write

it('creates an item after checking its references and audits it', function () {
    actingAsRole('user');
    $sari = person();

    $this->postJson('/api/v1/items', ['name' => 'Kain', 'kind' => 'kain', 'responsible_id' => $sari['id'], 'quantity' => 5, 'unit' => 'm'])
        ->assertCreated()
        ->assertJsonPath('data.responsible.name', 'Sari')
        ->assertJsonPath('data.version', 1);

    $audit = AuditEvent::query()->where('action', 'item.created')->sole();
    expect($audit->new_value)->toMatchArray(['console' => 'gudang', 'name' => 'Kain'])
        ->and(FakeSources::calls('gudang', 'POST'))->toHaveCount(1);
});

it('refuses a reference that does not exist or is inactive, without calling the owner', function (string $state) {
    actingAsRole('user');
    $id = $state === 'missing' ? (string) Str::uuid() : person(['status' => 'nonaktif'])['id'];

    $response = $this->postJson('/api/v1/items', ['name' => 'Kain', 'kind' => 'kain', 'responsible_id' => $id]);

    assertApiError($response, 422, 'REFERENCE_NOT_FOUND');
    $response->assertJsonPath('error.details.fields.responsible_id.0', 'Personel yang dipilih tidak ditemukan atau sudah nonaktif.');
    expect(FakeSources::calls('gudang', 'POST'))->toBe([]);
})->with(['missing', 'inactive']);

it('does not write when the referenced source is down', function () {
    actingAsRole('user');
    FakeSources::$down = ['hr'];

    assertApiError($this->postJson('/api/v1/productions', ['area' => 'Area Logam B', 'production_type' => 'Pengecoran', 'courier_id' => (string) Str::uuid()]), 502, 'SOURCE_UNREACHABLE');
    expect(FakeSources::calls('produksi', 'POST'))->toBe([]);
});

it('validates the shape before calling any source', function () {
    actingAsRole('user');

    $response = $this->postJson('/api/v1/items', ['name' => 'K', 'responsible_id' => 'bukan-uuid']);

    assertApiError($response, 422, 'VALIDATION_ERROR');
    expect(array_keys($response->json('error.details.fields')))->toEqualCanonicalizing(['name', 'kind', 'responsible_id'])
        ->and(FakeSources::$calls)->toBe([]);
});

it('updates with expected_version, audits old and new, and passes VERSION_CONFLICT through', function () {
    actingAsRole('admin_it');
    $p = person();

    $this->patchJson("/api/v1/people/{$p['id']}", ['role' => 'Staf Gudang', 'expected_version' => 1])->assertOk()->assertJsonPath('data.version', 2);
    assertApiError($this->patchJson("/api/v1/people/{$p['id']}", ['role' => 'Kurir', 'expected_version' => 1]), 409, 'VERSION_CONFLICT');

    $audit = AuditEvent::query()->where('action', 'person.updated')->sole();
    expect($audit->old_value)->toBe(['role' => 'Kurir'])->and($audit->new_value)->toMatchArray(['role' => 'Staf Gudang']);
});

it('requires expected_version on PATCH and DELETE', function () {
    actingAsRole('admin_it');
    $p = person();

    assertApiError($this->patchJson("/api/v1/people/{$p['id']}", ['role' => 'X Y']), 422, 'VALIDATION_ERROR');
    assertApiError($this->deleteJson("/api/v1/people/{$p['id']}"), 422, 'VALIDATION_ERROR');
});

it('checks permissions per resource and action', function () {
    actingAsRole('user');
    $p = person();

    assertApiError($this->postJson('/api/v1/people', ['name' => 'Rina', 'role' => 'Kurir']), 403, 'FORBIDDEN');
    assertApiError($this->deleteJson("/api/v1/people/{$p['id']}?expected_version=1"), 403, 'FORBIDDEN');
    expect(FakeSources::$calls)->toBe([]);
});

// ---- deactivate

it('refuses to deactivate a person still used by an item or a production', function (string $usedBy) {
    actingAsRole('admin_it');
    $p = person();
    $usedBy === 'item' ? item(['responsible_id' => $p['id']]) : production(['courier_id' => $p['id']]);

    $response = $this->deleteJson("/api/v1/people/{$p['id']}?expected_version=1");

    assertApiError($response, 409, 'REFERENCED');
    expect($response->json('error.details.used_by.0'))->toMatchArray(['source' => $usedBy === 'item' ? 'gudang' : 'produksi', 'type' => $usedBy])
        ->and(FakeSources::calls('hr', 'DELETE'))->toBe([]);
})->with(['item', 'production']);

it('refuses to deactivate a production used by an item, without used_by for User', function () {
    $user = actingAsRole('user');
    $user->role->permissions()->attach(Permission::query()->firstOrCreate(['code' => 'produksi.delete'])->id);
    $p = production();
    item(['production_id' => $p['id']]);

    $response = $this->deleteJson("/api/v1/productions/{$p['id']}?expected_version=1");

    assertApiError($response, 409, 'REFERENCED');
    $response->assertJsonPath('error.details', []);
});

it('deactivates a record nobody uses (inactive users do not count) and audits it', function () {
    actingAsRole('admin_it');
    $p = person();
    item(['responsible_id' => $p['id'], 'status' => 'nonaktif']);

    $this->deleteJson("/api/v1/people/{$p['id']}?expected_version=1")->assertOk()->assertJsonPath('data.status', 'nonaktif');

    expect(AuditEvent::query()->where('action', 'person.deactivated')->count())->toBe(1);
});

it('deactivates an item without any usage check', function () {
    actingAsRole('admin_it');
    $i = item();

    $this->deleteJson("/api/v1/items/{$i['id']}?expected_version=1")->assertOk()->assertJsonPath('data.status', 'nonaktif');
    expect(FakeSources::calls('hr'))->toBe([])->and(FakeSources::calls('produksi'))->toBe([]);
});

it('does not deactivate when a source that must be checked is down', function () {
    actingAsRole('admin_it');
    $p = person();
    FakeSources::$down = ['produksi'];

    assertApiError($this->deleteJson("/api/v1/people/{$p['id']}?expected_version=1"), 502, 'SOURCE_UNREACHABLE');
    expect(FakeSources::calls('hr', 'DELETE'))->toBe([]);
});

it('never puts a service key in responses, errors, audit or logs', function () {
    actingAsRole('admin_it');
    Log::spy();
    $p = person();
    FakeSources::$down = ['gudang'];

    $responses = [
        $this->getJson('/api/v1/people')->getContent(),
        $this->patchJson("/api/v1/people/{$p['id']}", ['role' => 'Staf Gudang', 'expected_version' => 1])->getContent(),
        $this->deleteJson("/api/v1/people/{$p['id']}?expected_version=2")->getContent(),
    ];

    expect(implode('', $responses).AuditEvent::all()->toJson())->not->toContain('test-key-');
    Log::shouldNotHaveReceived('error', fn ($message, $context = []) => str_contains(json_encode($context), 'test-key-'));
});

it('never forwards a client-chosen id', function () {
    actingAsRole('admin_it');

    $this->postJson('/api/v1/people', ['id' => '11111111-1111-4111-8111-111111111111', 'name' => 'Rina', 'role' => 'Kurir'])->assertCreated();

    expect(FakeSources::$rows['people'])->not->toHaveKey('11111111-1111-4111-8111-111111111111');
});
