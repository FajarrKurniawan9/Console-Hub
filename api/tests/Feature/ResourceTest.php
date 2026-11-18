<?php

use App\Models\AuditEvent;
use App\Models\Console;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

function resourceConsole(array $resource, array $attributes = []): Console
{
    return Console::factory()->create([
        'name' => 'Web HR',
        'slug' => 'hr',
        'base_url' => 'http://hr.test',
        'config' => ['resources' => [array_merge([
            'key' => 'employees', 'label' => 'Karyawan', 'list_path' => '/employees', 'item_path' => '/employees/{id}',
            'id_field' => 'id', 'data_path' => 'data', 'update_method' => 'PATCH', 'writable_fields' => ['name', 'role'],
        ], $resource)]],
        ...$attributes,
    ]);
}

beforeEach(fn () => Sanctum::actingAs(User::factory()->create()));

it('lists the resources configured for a console', function () {
    $console = resourceConsole([]);

    $this->getJson("/api/v1/consoles/{$console->id}/resources")
        ->assertOk()
        ->assertJsonPath('data', [['key' => 'employees', 'label' => 'Karyawan', 'writable_fields' => ['name', 'role']]]);
});

it('forwards paging and search to consoles that report a total', function () {
    $console = resourceConsole([]);
    Http::fake(['hr.test/employees*' => Http::response(['data' => [['id' => 3, 'name' => 'Sari']], 'meta' => ['total' => 25]])]);

    $this->getJson("/api/v1/consoles/{$console->id}/resources/employees?page=2&per_page=10&q=sa")
        ->assertOk()
        ->assertJsonPath('data.0.name', 'Sari')
        ->assertJsonPath('meta', ['next_cursor' => '3', 'total' => 25]);

    Http::assertSent(fn (Request $r) => $r['page'] == 2 && $r['per_page'] == 10 && $r['q'] === 'sa');
});

it('pages and filters in memory when the console returns a plain array', function () {
    $console = resourceConsole(['data_path' => null, 'id_field' => 'sku', 'key' => 'items', 'list_path' => '/items', 'item_path' => '/items/{id}']);
    $rows = collect(range(1, 5))->map(fn ($i) => ['sku' => "SKU-{$i}", 'name' => $i % 2 ? "Baut {$i}" : "Mur {$i}"])->all();
    Http::fake(['hr.test/items*' => Http::response($rows)]);

    $this->getJson("/api/v1/consoles/{$console->id}/resources/items?page=1&per_page=2&q=baut")
        ->assertOk()
        ->assertJsonPath('data.0.sku', 'SKU-1')
        ->assertJsonPath('data.1.sku', 'SKU-3')
        ->assertJsonPath('meta', ['next_cursor' => '2', 'total' => 3]);
});

it('returns 404 for an unknown resource and 409 for an inactive console', function () {
    $console = resourceConsole([]);
    $inactive = resourceConsole([], ['slug' => 'off', 'is_active' => false]);

    assertApiError($this->getJson("/api/v1/consoles/{$console->id}/resources/nope"), 404, 'NOT_FOUND');
    assertApiError($this->getJson("/api/v1/consoles/{$inactive->id}/resources/employees"), 409, 'CONFLICT');
    Http::assertNothingSent();
});

it('rejects fields outside writable_fields without calling the console', function () {
    $console = resourceConsole([]);

    $response = $this->patchJson("/api/v1/consoles/{$console->id}/resources/employees/7", ['fields' => ['name' => 'Ok', 'salary' => 1]]);

    assertApiError($response, 422, 'VALIDATION_FAILED');
    $response->assertJsonPath('error.fields.salary.0', 'Field ini tidak boleh diubah.');
    Http::assertNothingSent();
});

it('rejects empty fields without calling the console', function () {
    $console = resourceConsole([]);

    assertApiError($this->patchJson("/api/v1/consoles/{$console->id}/resources/employees/7", ['fields' => []]), 422, 'VALIDATION_FAILED');
    Http::assertNothingSent();
});

it('updates a record and audits old and new values', function () {
    $console = resourceConsole([]);
    Http::fake(['hr.test/employees/7' => Http::sequence()
        ->push(['data' => ['id' => 7, 'name' => 'Budi', 'role' => 'Staf']])
        ->push(['ok' => true])
        ->push(['data' => ['id' => 7, 'name' => 'Budi Santoso', 'role' => 'Staf']]),
    ]);

    $this->patchJson("/api/v1/consoles/{$console->id}/resources/employees/7", ['fields' => ['name' => 'Budi Santoso']])
        ->assertOk()
        ->assertJsonPath('data', ['id' => 7, 'name' => 'Budi Santoso', 'role' => 'Staf']);

    Http::assertSent(fn (Request $r) => $r->method() === 'PATCH' && $r->data() === ['name' => 'Budi Santoso']);

    $audit = AuditEvent::query()->firstWhere('action', 'resource.updated');
    expect($audit->console_id)->toBe($console->id)
        ->and($audit->target_id)->toBe('7')
        ->and($audit->details)->toEqualCanonicalizing([
            'resource' => 'employees',
            'record_id' => '7',
            'changes' => ['name' => ['old' => 'Budi', 'new' => 'Budi Santoso']],
        ]);
});

it('uses the configured update_method PUT', function () {
    $console = resourceConsole(['key' => 'prices', 'list_path' => '/settings/prices', 'item_path' => '/settings/prices/{id}', 'id_field' => 'sku', 'data_path' => null, 'update_method' => 'PUT', 'writable_fields' => ['price_idr']]);
    Http::fake(['hr.test/settings/prices/*' => Http::sequence()
        ->push(['sku' => 'BJ-1', 'price_idr' => 1000])
        ->push([], 204)
        ->push(['sku' => 'BJ-1', 'price_idr' => 1200]),
    ]);

    $this->patchJson("/api/v1/consoles/{$console->id}/resources/prices/BJ-1", ['fields' => ['price_idr' => 1200]])
        ->assertOk()
        ->assertJsonPath('data.price_idr', 1200);

    Http::assertSent(fn (Request $r) => $r->method() === 'PUT' && $r->url() === 'http://hr.test/settings/prices/BJ-1');
});

it('maps a console 422 to VALIDATION_FAILED with console fields', function () {
    $console = resourceConsole([]);
    Http::fake(['hr.test/employees/7' => Http::sequence()
        ->push(['data' => ['id' => 7, 'name' => 'Budi']])
        ->push(['errors' => ['name' => ['Nama terlalu pendek']]], 422),
    ]);

    $response = $this->patchJson("/api/v1/consoles/{$console->id}/resources/employees/7", ['fields' => ['name' => 'B']]);

    assertApiError($response, 422, 'VALIDATION_FAILED');
    $response->assertJsonPath('error.fields.name.0', 'Nama terlalu pendek')->assertJsonPath('error.console', 'hr');
    expect(AuditEvent::query()->where('action', 'resource.updated')->exists())->toBeFalse();
});

it('maps other console failures to CONSOLE_ERROR', function () {
    $console = resourceConsole([]);
    Http::fake(['hr.test/employees/7' => Http::sequence()
        ->push(['data' => ['id' => 7]])
        ->push(['message' => 'boom'], 500),
    ]);

    assertApiError($this->patchJson("/api/v1/consoles/{$console->id}/resources/employees/7", ['fields' => ['name' => 'X']]), 502, 'CONSOLE_ERROR');
});
