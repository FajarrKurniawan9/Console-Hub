<?php

use App\Models\AuditEvent;
use App\Models\Console;
use App\Models\LogEntry;
use App\Models\LogSyncState;
use App\Services\LogSync;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;

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
        'fingerprint' => sha1((string) $n.microtime()),
        'raw' => ['n' => $n],
        ...$attributes,
    ]);
}

beforeEach(function () {
    Carbon::setTestNow('2026-11-19 10:00:00');
    actingAsRole('admin_it');
});

it('lists logs newest first in the LogEntry shape without raw', function () {
    $console = Console::factory()->create(['slug' => 'hr', 'name' => 'HR']);
    makeLog($console, ['occurred_at' => now()->subMinute(), 'message' => 'lama']);
    makeLog($console, ['message' => 'baru', 'tx_id' => '7f1c1e7e-6a0b-4f2a-9f0e-0a0b0c0d0e0f']);

    $this->getJson('/api/v1/admin/logs')
        ->assertOk()
        ->assertJsonPath('data.0.message', 'baru')
        ->assertJsonPath('data.0.console', ['id' => $console->id, 'slug' => 'hr', 'name' => 'HR'])
        ->assertJsonPath('data.0.tx_id', '7f1c1e7e-6a0b-4f2a-9f0e-0a0b0c0d0e0f')
        ->assertJsonPath('data.0.occurred_at', '2026-11-19T10:00:00Z')
        ->assertJsonMissingPath('data.0.raw')
        ->assertJsonPath('meta.next_cursor', null);
});

it('filters by consoles, levels, text (also tx_id) and time, and paginates', function () {
    $hr = Console::factory()->create(['slug' => 'hr']);
    $gudang = Console::factory()->create(['slug' => 'gudang']);
    makeLog($hr, ['level' => 'error', 'message' => 'Gagal simpan']);
    makeLog($gudang, ['level' => 'warn', 'message' => 'Stok 50% habis', 'occurred_at' => now()->subHours(3)]);
    makeLog($gudang, ['level' => 'info', 'message' => 'ok', 'tx_id' => '11111111-2222-3333-4444-555555555555']);

    $this->getJson("/api/v1/admin/logs?console_id={$gudang->id}")->assertJsonCount(2, 'data');
    $this->getJson('/api/v1/admin/logs?level=error,warn')->assertJsonCount(2, 'data');
    $this->getJson('/api/v1/admin/logs?q=simpan')->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/admin/logs?q=50%25')->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/admin/logs?q=33-4444')->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/admin/logs?from=2026-11-19T08:00:00Z')->assertJsonCount(2, 'data');
    $this->getJson('/api/v1/admin/logs?limit=2')->assertJsonCount(2, 'data')->assertJsonPath('meta.next_cursor', fn ($c) => is_string($c));
    assertApiError($this->getJson('/api/v1/admin/logs?cursor=rusak'), 422, 'VALIDATION_FAILED');
});

it('shows one log with raw', function () {
    $log = makeLog(Console::factory()->create(), ['raw' => ['asli' => true]]);

    $this->getJson("/api/v1/admin/logs/{$log->id}")->assertOk()->assertJsonPath('data.raw', ['asli' => true]);
});

it('pulls logs from the internal api idempotently and pages through the cursor', function () {
    $console = Console::factory()->create(['slug' => 'hr', 'base_url' => 'http://hr.test', 'service_key' => 'k-hr']);
    $entry = ['occurred_at' => '2026-11-19T09:58:00Z', 'level' => 'ERROR', 'message' => 'Gagal', 'actor' => 'budi', 'tx_id' => null];
    Http::fake([
        'hr.test/internal/v1/logs*' => Http::sequence()
            ->push(['data' => [$entry], 'meta' => ['next_cursor' => 'c2']])
            ->push(['data' => [['occurred_at' => '2026-11-19T09:59:00Z', 'level' => 'warning', 'message' => 'Lambat', 'actor' => null]], 'meta' => ['next_cursor' => null]])
            ->push(['data' => [$entry], 'meta' => ['next_cursor' => null]]),
    ]);

    $sync = app(LogSync::class);
    expect($sync->syncConsole($console))->toMatchArray(['status' => 'ok', 'inserted' => 2])
        ->and($sync->syncConsole($console))->toMatchArray(['status' => 'ok', 'inserted' => 0]);

    expect(LogEntry::query()->where('message', 'Gagal')->value('level'))->toBe('error')
        ->and(LogEntry::query()->where('message', 'Lambat')->value('level'))->toBe('warn')
        ->and(LogSyncState::query()->find($console->id)->last_synced_at)->not->toBeNull();
    Http::assertSent(fn (Request $r) => $r->header('X-Service-Key') === ['k-hr'] && str_contains($r->url(), 'since='));
    Http::assertSent(fn (Request $r) => str_contains($r->url(), 'cursor=c2'));
});

it('syncs every active console on demand, a dead console does not stop the others', function () {
    $hr = Console::factory()->create(['slug' => 'hr', 'name' => 'HR', 'base_url' => 'http://hr.test']);
    Console::factory()->create(['slug' => 'gudang', 'name' => 'Gudang', 'base_url' => 'http://gudang.test']);
    Http::fake([
        'hr.test/*' => Http::response(['data' => [['occurred_at' => '2026-11-19T09:00:00Z', 'level' => 'info', 'message' => 'hai']], 'meta' => ['next_cursor' => null]]),
        'gudang.test/*' => Http::failedConnection(),
    ]);

    $response = $this->postJson('/api/v1/admin/logs/sync')->assertStatus(202);

    expect(collect($response->json('data'))->keyBy('console.slug')->all())->toMatchArray([
        'hr' => ['console' => ['slug' => 'hr', 'name' => 'HR'], 'status' => 'ok', 'inserted' => 1, 'error' => null],
        'gudang' => ['console' => ['slug' => 'gudang', 'name' => 'Gudang'], 'status' => 'failed', 'inserted' => null, 'error' => 'Gudang tidak dapat dihubungi.'],
    ]);
    expect(AuditEvent::query()->where('action', 'logs.synced')->exists())->toBeTrue();

    $this->postJson('/api/v1/admin/logs/sync', ['console_id' => $hr->id])->assertStatus(202)->assertJsonCount(1, 'data');
});

it('makes the fingerprint from console, time, message and actor', function () {
    $t = CarbonImmutable::parse('2026-11-19T09:00:00Z');

    expect(LogSync::fingerprint(1, $t, 'a', null))->toBe(LogSync::fingerprint(1, $t, 'a', null))
        ->not->toBe(LogSync::fingerprint(1, $t, 'a', 'budi'))
        ->not->toBe(LogSync::fingerprint(2, $t, 'a', null));
});
