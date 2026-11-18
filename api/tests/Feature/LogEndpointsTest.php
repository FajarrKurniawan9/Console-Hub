<?php

use App\Models\AuditEvent;
use App\Models\Console;
use App\Models\LogEntry;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

function makeLog(Console $console, array $attributes = []): LogEntry
{
    static $n = 0;
    $n++;

    return LogEntry::query()->create([
        'console_id' => $console->id,
        'occurred_at' => now(),
        'level' => 'info',
        'message' => "pesan {$n}",
        'actor' => null,
        'dedupe_key' => sha1((string) $n.microtime()),
        'raw' => ['n' => $n],
        'ingested_at' => now(),
        ...$attributes,
    ]);
}

beforeEach(function () {
    Carbon::setTestNow('2026-11-18 10:00:00');
    Sanctum::actingAs(User::factory()->create());
});

it('lists logs newest first in the contract shape without raw', function () {
    $console = Console::factory()->create(['slug' => 'hr', 'name' => 'Web HR']);
    makeLog($console, ['occurred_at' => now()->subMinutes(2), 'message' => 'lama']);
    makeLog($console, ['occurred_at' => now()->subMinute(), 'message' => 'baru', 'level' => 'error', 'actor' => 'budi']);

    $this->getJson('/api/v1/logs')
        ->assertOk()
        ->assertJsonPath('data.0.message', 'baru')
        ->assertJsonPath('data.0.occurred_at', '2026-11-18T09:59:00Z')
        ->assertJsonPath('data.0.console', ['id' => $console->id, 'slug' => 'hr', 'name' => 'Web HR'])
        ->assertJsonPath('data.0.actor', 'budi')
        ->assertJsonMissingPath('data.0.raw')
        ->assertJsonPath('meta', ['next_cursor' => null, 'total' => null]);
});

it('filters by comma separated consoles and levels, text and time range', function () {
    $a = Console::factory()->create();
    $b = Console::factory()->create();
    $c = Console::factory()->create();
    makeLog($a, ['level' => 'error', 'message' => 'Stok HABIS di gudang']);
    makeLog($b, ['level' => 'warn', 'message' => 'stok menipis']);
    makeLog($c, ['level' => 'error', 'message' => 'stok habis juga']);
    makeLog($a, ['level' => 'info', 'message' => 'stok habis info']);
    makeLog($a, ['level' => 'error', 'message' => 'stok habis kemarin', 'occurred_at' => now()->subDays(2)]);

    $response = $this->getJson("/api/v1/logs?console_id={$a->id},{$b->id}&level=error,warn&q=stok&from=2026-11-18T00:00:00Z&to=2026-11-18T23:59:59Z")->assertOk();

    expect(collect($response->json('data'))->pluck('message')->sort()->values()->all())->toBe(['Stok HABIS di gudang', 'stok menipis']);
});

it('escapes like wildcards in q', function () {
    $console = Console::factory()->create();
    makeLog($console, ['message' => '100% selesai']);
    makeLog($console, ['message' => '100 selesai']);

    expect($this->getJson('/api/v1/logs?q=100%25')->json('data'))->toHaveCount(1);
});

it('paginates with a keyset cursor', function () {
    $console = Console::factory()->create();
    foreach (range(1, 5) as $i) {
        makeLog($console, ['occurred_at' => now()->subMinutes($i), 'message' => "m{$i}"]);
    }
    makeLog($console, ['occurred_at' => now()->subMinutes(3), 'message' => 'm3b']);

    $seen = [];
    $cursor = null;

    do {
        $page = $this->getJson('/api/v1/logs?limit=2'.($cursor ? "&cursor={$cursor}" : ''))->assertOk();
        $seen = [...$seen, ...collect($page->json('data'))->pluck('message')->all()];
        $cursor = $page->json('meta.next_cursor');
    } while ($cursor);

    expect($seen)->toHaveCount(6)->and(array_unique($seen))->toHaveCount(6)
        ->and($seen[0])->toBe('m1')->and($seen[5])->toBe('m5');
});

it('rejects a malformed cursor and out of range limit', function () {
    assertApiError($this->getJson('/api/v1/logs?cursor=garbage'), 422, 'VALIDATION_FAILED');
    assertApiError($this->getJson('/api/v1/logs?limit=500'), 422, 'VALIDATION_FAILED');
    assertApiError($this->getJson('/api/v1/logs?level=fatal'), 422, 'VALIDATION_FAILED');
});

it('shows a single log with raw', function () {
    $log = makeLog(Console::factory()->create(), ['raw' => ['asli' => true]]);

    $this->getJson("/api/v1/logs/{$log->id}")->assertOk()->assertJsonPath('data.raw', ['asli' => true]);
    assertApiError($this->getJson('/api/v1/logs/999999'), 404, 'NOT_FOUND');
});

it('syncs on demand and reports per console with 202', function () {
    $ok = Console::factory()->create(['slug' => 'produksi', 'name' => 'Web Produksi', 'base_url' => 'http://produksi.test', 'config' => [
        'logs' => ['path' => '/log', 'pagination' => 'none', 'list_path' => null, 'map' => ['occurred_at' => ['field' => 't', 'format' => 'iso8601'], 'message' => ['field' => 'm']]],
    ]]);
    $down = Console::factory()->create(['slug' => 'gudang', 'name' => 'Web Gudang', 'base_url' => 'http://gudang.test', 'config' => [
        'logs' => ['path' => '/audit', 'pagination' => 'none', 'list_path' => null, 'map' => []],
    ]]);
    Http::fake([
        'produksi.test/*' => Http::response([['t' => '2026-11-18T09:00:00Z', 'm' => 'hai']]),
        'gudang.test/*' => Http::failedConnection(),
    ]);

    $response = $this->postJson('/api/v1/logs/sync')->assertStatus(202);

    expect(collect($response->json('data.results'))->keyBy('console.slug')->all())->toMatchArray([
        'produksi' => ['console' => ['slug' => 'produksi', 'name' => 'Web Produksi'], 'ok' => true, 'fetched' => 1, 'message' => null],
        'gudang' => ['console' => ['slug' => 'gudang', 'name' => 'Web Gudang'], 'ok' => false, 'fetched' => null, 'message' => 'Web Gudang tidak dapat dihubungi.'],
    ]);
    expect(AuditEvent::query()->where('action', 'logs.synced')->exists())->toBeTrue();

    $this->postJson('/api/v1/logs/sync', ['console_id' => $ok->id])->assertStatus(202)->assertJsonCount(1, 'data.results');
});

it('returns the overview', function () {
    $console = Console::factory()->create();
    makeLog($console, ['level' => 'error']);
    makeLog($console, ['level' => 'error', 'occurred_at' => now()->subDays(2)]);
    makeLog($console, ['level' => 'warn']);

    $this->getJson('/api/v1/overview')
        ->assertOk()
        ->assertJsonPath('data.error_logs_24h', 1)
        ->assertJsonCount(1, 'data.consoles')
        ->assertJsonPath('data.recent_runs', []);
});
