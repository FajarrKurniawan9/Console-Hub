<?php

use App\Models\Console;
use App\Models\LogEntry;
use App\Models\LogSyncState;
use App\Services\LogSync;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;

/**
 * Build a console from the seeder data so tests exercise the real Appendix A config.
 */
function seededConsole(string $slug, string $baseUrl): Console
{
    $data = collect(json_decode(file_get_contents(database_path('seeders/data/consoles.json')), true))->firstWhere('slug', $slug);

    return Console::factory()->create([
        ...collect($data)->only(['slug', 'name', 'auth_type', 'timezone', 'config'])->all(),
        'base_url' => $baseUrl,
        'credentials' => $slug === 'hr' ? ['header' => 'X-API-Key', 'key' => 'k'] : ['username' => 'u', 'password' => 'p'],
    ]);
}

beforeEach(function () {
    Carbon::setTestNow('2026-11-18 10:00:00');
});

it('maps HR iso8601 logs with page pagination', function () {
    $console = seededConsole('hr', 'http://hr.test');
    Http::fake([
        'hr.test/logs?page=1*' => Http::response(['data' => [
            ['timestamp' => '2026-11-18T09:58:00+00:00', 'level' => 'ERROR', 'message' => 'Gagal simpan', 'actor' => 'budi'],
            ['timestamp' => '2026-11-18T09:57:00Z', 'level' => 'TRACE', 'message' => 'Tingkat aneh', 'actor' => null],
        ]]),
        'hr.test/logs?page=2*' => Http::response(['data' => []]),
    ]);

    $result = app(LogSync::class)->syncConsole($console);

    expect($result)->toMatchArray(['status' => 'ok', 'inserted' => 2, 'error' => null]);
    $error = LogEntry::query()->where('message', 'Gagal simpan')->first();
    expect($error->level)->toBe('error')
        ->and($error->actor)->toBe('budi')
        ->and($error->occurred_at->utc()->toIso8601ZuluString())->toBe('2026-11-18T09:58:00Z')
        ->and($error->raw['level'])->toBe('ERROR')
        ->and(LogEntry::query()->where('message', 'Tingkat aneh')->value('level'))->toBe('info');
    Http::assertSent(fn (Request $r) => str_contains($r->url(), 'per_page=50'));
});

it('maps Gudang epoch logs with since cursor and bearer auth', function () {
    $console = seededConsole('gudang', 'http://gudang.test');
    Http::fake([
        'gudang.test/auth/login' => Http::response(['access_token' => 't']),
        'gudang.test/audit*' => Http::response(['entries' => [
            ['time' => 1763459880, 'severity' => 2, 'msg' => 'Stok menipis', 'user' => 'sari'],
            ['time' => 1763459940, 'severity' => '3', 'msg' => 'Reservasi gagal', 'user' => 'sari'],
        ]]),
    ]);

    app(LogSync::class)->syncConsole($console);

    expect(LogEntry::query()->where('message', 'Stok menipis')->value('level'))->toBe('warn')
        ->and(LogEntry::query()->where('message', 'Reservasi gagal')->value('level'))->toBe('error');
    Http::assertSent(fn (Request $r) => str_contains($r->url(), '/audit') && $r['since'] == now()->subDay()->getTimestamp());
    expect(LogSyncState::query()->find($console->id)->cursor)->toBe(['since' => Carbon::createFromTimestamp(1763459940)->toIso8601ZuluString()]);

    app(LogSync::class)->syncConsole($console);

    Http::assertSent(fn (Request $r) => str_contains($r->url(), '/audit') && $r['since'] == 1763459940);
});

it('maps Produksi WIB date pattern logs to UTC with no pagination', function () {
    $console = seededConsole('produksi', 'http://produksi.test');
    Http::fake(['produksi.test/log' => Http::response([
        ['waktu' => '18/11/2026 16:30:00', 'tingkat' => 'GALAT', 'pesan' => 'Mesin 3 berhenti', 'pengguna' => 'operator1'],
        ['waktu' => '18/11/2026 16:31:00', 'tingkat' => 'peringatan', 'pesan' => 'Suhu tinggi', 'pengguna' => ''],
    ])]);

    app(LogSync::class)->syncConsole($console);

    $entry = LogEntry::query()->where('message', 'Mesin 3 berhenti')->first();
    expect($entry->occurred_at->utc()->toIso8601ZuluString())->toBe('2026-11-18T09:30:00Z')
        ->and($entry->level)->toBe('error')
        ->and(LogEntry::query()->where('message', 'Suhu tinggi')->first()->only(['level', 'actor']))->toBe(['level' => 'warn', 'actor' => null]);
});

it('does not duplicate entries when pulling twice', function () {
    $console = seededConsole('produksi', 'http://produksi.test');
    Http::fake(['produksi.test/log' => Http::response([
        ['waktu' => '18/11/2026 16:30:00', 'tingkat' => 'INFO', 'pesan' => 'Satu', 'pengguna' => 'a'],
        ['waktu' => '18/11/2026 16:31:00', 'tingkat' => 'INFO', 'pesan' => 'Dua', 'pengguna' => 'a'],
    ])]);

    $first = app(LogSync::class)->syncConsole($console);
    $second = app(LogSync::class)->syncConsole($console);

    expect($first['inserted'])->toBe(2)
        ->and($second['inserted'])->toBe(0)
        ->and(LogEntry::query()->count())->toBe(2);
});

it('stops paging once a whole page predates the last success', function () {
    $console = seededConsole('hr', 'http://hr.test');
    LogSyncState::query()->create(['console_id' => $console->id, 'last_success_at' => now()->subMinutes(5)]);
    Http::fake([
        'hr.test/logs?page=1*' => Http::response(['data' => [['timestamp' => now()->subMinute()->toIso8601String(), 'level' => 'INFO', 'message' => 'baru']]]),
        'hr.test/logs?page=2*' => Http::response(['data' => [['timestamp' => now()->subHour()->toIso8601String(), 'level' => 'INFO', 'message' => 'lama']]]),
        'hr.test/logs?page=3*' => Http::response(['data' => [['timestamp' => now()->subHours(2)->toIso8601String(), 'level' => 'INFO', 'message' => 'lebih lama']]]),
    ]);

    app(LogSync::class)->syncConsole($console);

    Http::assertSentCount(2);
});

it('caps page pulls at 20 pages', function () {
    $console = seededConsole('hr', 'http://hr.test');
    Http::fake(['hr.test/logs*' => fn (Request $r) => Http::response(['data' => [['timestamp' => now()->toIso8601String(), 'level' => 'INFO', 'message' => 'p'.$r['page']]]])]);

    app(LogSync::class)->syncConsole($console);

    Http::assertSentCount(20);
});

it('records a failure for one console without stopping the others', function () {
    $down = seededConsole('produksi', 'http://produksi.test');
    $up = seededConsole('hr', 'http://hr.test');
    Http::fake([
        'produksi.test/*' => Http::failedConnection(),
        'hr.test/logs?page=1*' => Http::response(['data' => [['timestamp' => now()->toIso8601String(), 'level' => 'INFO', 'message' => 'ok']]]),
        'hr.test/logs?page=2*' => Http::response(['data' => []]),
    ]);

    $this->artisan('logs:sync')->assertSuccessful();

    expect(LogSyncState::query()->find($down->id)->last_error)->toBe('Web Produksi tidak dapat dihubungi.')
        ->and(LogSyncState::query()->find($up->id)->last_error)->toBeNull()
        ->and(LogSyncState::query()->find($up->id)->last_success_at)->not->toBeNull()
        ->and(LogEntry::query()->where('console_id', $up->id)->count())->toBe(1);
});

it('clears last_error after a later success', function () {
    $console = seededConsole('produksi', 'http://produksi.test');
    LogSyncState::query()->create(['console_id' => $console->id, 'last_error' => 'lama']);
    Http::fake(['produksi.test/log' => Http::response([])]);

    app(LogSync::class)->syncConsole($console);

    expect(LogSyncState::query()->find($console->id)->last_error)->toBeNull();
});

it('fails clearly when the list path is missing from the response', function () {
    $console = seededConsole('hr', 'http://hr.test');
    Http::fake(['hr.test/*' => Http::response(['items' => []])]);

    expect(app(LogSync::class)->syncConsole($console))
        ->toMatchArray(['status' => 'failed', 'error' => 'Respons log Web HR tidak berisi daftar entri.']);
});

it('prunes old logs and health checks', function () {
    $console = Console::factory()->create();
    LogEntry::query()->insert([
        ['console_id' => $console->id, 'occurred_at' => now()->subDays(31), 'level' => 'info', 'message' => 'tua', 'dedupe_key' => str_repeat('a', 40), 'ingested_at' => now()],
        ['console_id' => $console->id, 'occurred_at' => now()->subDays(1), 'level' => 'info', 'message' => 'muda', 'dedupe_key' => str_repeat('b', 40), 'ingested_at' => now()],
    ]);
    $console->healthChecks()->createMany([
        ['status' => 'ok', 'checked_at' => now()->subDays(8)],
        ['status' => 'ok', 'checked_at' => now()->subDays(2)],
    ]);

    $this->artisan('logs:prune')->assertSuccessful();

    expect(LogEntry::query()->pluck('message')->all())->toBe(['muda'])
        ->and($console->healthChecks()->count())->toBe(1);
});
