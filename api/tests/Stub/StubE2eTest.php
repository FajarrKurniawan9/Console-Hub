<?php

use App\Console\Commands\HubSeedDemo;
use App\Models\Console;
use Illuminate\Support\Facades\Http;

/*
| Hub against the running tools/console-stub (not part of the normal suite):
|   STUB_E2E=1 CONSOLE_HR_KEY=... CONSOLE_GUDANG_KEY=... CONSOLE_PRODUKSI_KEY=... vendor/bin/pest tests/Stub
| Resets the stubs, so never point it at real APIs.
*/

beforeEach(function () {
    if (! getenv('STUB_E2E')) {
        $this->markTestSkipped('Set STUB_E2E=1 with the stubs running.');
    }

    Http::allowStrayRequests();
    foreach (['hr' => [9101, 'people'], 'gudang' => [9102, 'items'], 'produksi' => [9103, 'productions']] as $slug => [$port, $resource]) {
        Console::factory()->create(['slug' => $slug, 'name' => ucfirst($slug), 'resource' => $resource, 'base_url' => "http://127.0.0.1:{$port}", 'service_key' => getenv('CONSOLE_'.strtoupper($slug).'_KEY')]);
        Http::post("http://127.0.0.1:{$port}/dev/reset");
    }
});

function fault(int $port, string $mode): void
{
    Http::post("http://127.0.0.1:{$port}/dev/fault", ['mode' => $mode]);
}

it('runs the manual scenarios against the stubs', function () {
    $this->artisan('hub:seed-demo')->assertSuccessful();
    $item = HubSeedDemo::itemId('Kain katun');
    $budi = HubSeedDemo::personId('Budi Santoso');

    // Normal
    actingAsRole('admin_it');
    $this->getJson('/api/v1/items?limit=100')->assertOk()->assertJsonCount(15, 'data')->assertJsonMissingPath('meta.unavailable');
    $this->getJson('/api/v1/productions')->assertOk()->assertJsonCount(6, 'data');
    $this->getJson('/api/v1/people')->assertOk()->assertJsonCount(11, 'data');
    $track = $this->getJson("/api/v1/tracking/items/{$item}")->assertOk()->json('data');
    expect($track['production']['courier']['name'])->toBe('Joko Susilo')
        ->and($track['responsible']['name'])->toBe('Rina Wulandari')
        ->and($track['warnings'])->toBe([])
        ->and(array_column($track['sources'], 'status'))->toBe(['ok', 'ok', 'ok']);

    // Masih dipakai
    $refused = $this->deleteJson("/api/v1/people/{$budi}?expected_version=1");
    assertApiError($refused, 409, 'REFERENCED');
    expect(count($refused->json('error.details.used_by')))->toBeGreaterThan(0);

    // Referensi tidak ada
    assertApiError($this->postJson('/api/v1/items', ['name' => 'Uji', 'kind' => 'uji', 'responsible_id' => (string) Str::uuid()]), 422, 'REFERENCE_NOT_FOUND');

    // Konflik versi
    $person = HubSeedDemo::personId('Lina Marlina');
    $this->patchJson("/api/v1/people/{$person}", ['role' => 'Admin Gudang', 'expected_version' => 1])->assertOk();
    assertApiError($this->patchJson("/api/v1/people/{$person}", ['role' => 'Admin Pencatatan', 'expected_version' => 1]), 409, 'VERSION_CONFLICT');

    // HR mati
    fault(9101, 'down');
    $this->getJson('/api/v1/items')->assertOk()->assertJsonPath('meta.unavailable', ['hr'])->assertJsonPath('data.0.responsible', null);
    $this->getJson("/api/v1/tracking/items/{$item}")->assertOk()->assertJsonPath('data.warnings', ['Data personel sedang tidak tersedia.']);
    assertApiError($this->postJson('/api/v1/people', ['name' => 'Rudi', 'role' => 'Kurir']), 502, 'SOURCE_UNREACHABLE');
    fault(9101, 'none');

    // Gudang mati
    fault(9102, 'down');
    assertApiError($this->getJson('/api/v1/items'), 502, 'SOURCE_UNREACHABLE');
    $this->getJson('/api/v1/productions')->assertOk();
    $this->getJson('/api/v1/people')->assertOk();
    fault(9102, 'none');

    // Log gabungan dan kesehatan
    $this->postJson('/api/v1/admin/logs/sync')->assertAccepted()->assertJsonPath('data.0.status', 'ok');
    foreach (Console::all() as $console) {
        $this->postJson("/api/v1/admin/consoles/{$console->id}/test")->assertOk()->assertJsonPath('data.status', 'ok');
    }
});
