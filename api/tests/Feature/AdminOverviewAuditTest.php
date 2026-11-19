<?php

use App\Models\AuditEvent;
use App\Models\ConsistencyCheck;
use App\Models\Console;
use App\Models\LogEntry;
use App\Models\Transaction;
use App\Models\TransactionParticipant;
use App\Services\Audit;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

beforeEach(fn () => Carbon::setTestNow('2026-11-19 10:00:00'));

it('returns the overview with counts, recent transactions and the last check', function () {
    $admin = actingAsRole('admin_it');
    $console = Console::factory()->create(['slug' => 'hr']);
    foreach ([[0, 'error'], [48, 'error'], [0, 'warn']] as $i => [$hoursAgo, $level]) {
        LogEntry::query()->create(['console_id' => $console->id, 'occurred_at' => now()->subHours($hoursAgo), 'level' => $level, 'message' => "m{$i}", 'fingerprint' => sha1("m{$i}")]);
    }
    $tx = Transaction::query()->create(['operation' => 'karyawan.create', 'entity_type' => 'karyawan', 'entity_id' => (string) Str::uuid(), 'payload' => [], 'state' => 'committed', 'idempotency_key' => 'k1', 'requested_by' => $admin->id]);
    TransactionParticipant::query()->create(['tx_id' => $tx->id, 'console_id' => $console->id, 'prepare_state' => 'ok', 'decision_state' => 'committed', 'latency_ms' => 120, 'version' => 1]);
    Transaction::query()->create(['operation' => 'barang.update', 'payload' => [], 'state' => 'aborted', 'idempotency_key' => 'k2']);
    ConsistencyCheck::query()->create(['entity_type' => 'karyawan', 'status' => 'clean', 'checked_count' => 12]);

    $this->getJson('/api/v1/admin/overview')
        ->assertOk()
        ->assertJsonPath('data.error_logs_24h', 1)
        ->assertJsonPath('data.tx_counts', ['aborted' => 1, 'committed' => 1])
        ->assertJsonCount(1, 'data.consoles')
        ->assertJsonCount(2, 'data.recent_transactions')
        ->assertJsonPath('data.recent_transactions.1.participants.0.console', ['slug' => 'hr', 'name' => $console->name])
        ->assertJsonPath('data.recent_transactions.1.participants.0.latency_ms', 120)
        ->assertJsonPath('data.recent_transactions.0.requested_by', ['id' => 0, 'name' => 'Sistem'])
        ->assertJsonPath('data.last_consistency.status', 'clean');
});

it('returns an empty overview on a fresh portal', function () {
    actingAsRole('admin_it');

    $this->getJson('/api/v1/admin/overview')->assertOk()
        ->assertJsonPath('data.tx_counts', [])
        ->assertJsonPath('data.last_consistency', null);
});

it('lists audit events in the AuditEvent shape with changes and filters', function () {
    $admin = actingAsRole('admin_it');
    $admin->update(['name' => 'Admin']);
    $audit = app(Audit::class);

    Carbon::setTestNow('2026-11-19 08:00:00');
    $audit->record('console.tested', 'console', '1', null, ['console' => 'hr', 'status' => 'ok']);
    Carbon::setTestNow('2026-11-19 09:00:00');
    auth()->forgetGuards();
    $audit->record('rbac.user_updated', 'user', '7', ['role' => 'user', 'is_active' => true], ['role' => 'admin_it', 'is_active' => true]);
    Sanctum::actingAs($admin);
    Carbon::setTestNow('2026-11-19 10:00:00');
    $hr = Console::factory()->create(['slug' => 'hr']);

    $this->getJson('/api/v1/admin/audit')
        ->assertOk()
        ->assertJsonPath('data.0.action', 'rbac.user_updated')
        ->assertJsonPath('data.0.user', null)
        ->assertJsonPath('data.0.target_type', 'user')
        ->assertJsonPath('data.0.target_id', '7')
        ->assertJsonPath('data.0.details.changes', ['role' => ['old' => 'user', 'new' => 'admin_it']])
        ->assertJsonPath('data.1.user', ['id' => $admin->id, 'name' => 'Admin'])
        ->assertJsonPath('data.1.console', ['slug' => 'hr'])
        ->assertJsonPath('data.1.created_at', '2026-11-19T08:00:00Z');

    $this->getJson("/api/v1/admin/audit?console_id={$hr->id}")->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/admin/audit?action=rbac.user_updated')->assertJsonCount(1, 'data');
    $this->getJson("/api/v1/admin/audit?user_id={$admin->id}")->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/admin/audit?from=2026-11-19T08:30:00Z')->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/admin/audit?limit=1')->assertJsonCount(1, 'data')->assertJsonPath('meta.next_cursor', fn ($c) => is_string($c));
    expect(AuditEvent::query()->whereNotNull('request_id')->count())->toBe(0);
});
