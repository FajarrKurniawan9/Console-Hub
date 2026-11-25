<?php

use App\Jobs\ProcessReportExport;
use App\Models\AuditEvent;
use App\Models\ReportExport;
use App\Services\Reports\ReportExportProcessor;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    Carbon::setTestNow('2026-11-25 10:00:00'); // 17:00 WIB
    Storage::fake('local');
    fakeSources();
});

it('schedules a one-time export for tomorrow without dispatching immediately and executes when due', function () {
    Queue::fake();
    $admin = actingAsRole('admin_it');

    $response = $this->postJson('/api/v1/reports/export', [
        'type' => 'barang',
        'format' => 'xlsx',
        'name' => 'Stok Besok Pagi',
        'scheduled_at' => '2026-11-26T08:00:00+07:00',
        'timezone' => 'Asia/Jakarta',
    ]);

    $response->assertStatus(202)
        ->assertJsonPath('data.status', 'scheduled')
        ->assertJsonPath('data.schedule_type', 'once')
        ->assertJsonPath('data.cron_expression', null)
        ->assertJsonPath('data.timezone', 'Asia/Jakarta')
        ->assertJsonPath('data.scheduled_at', '2026-11-26T01:00:00Z')
        ->assertJsonPath('data.queue_position', null)
        ->assertJsonPath('data.is_mine', true);

    $exportId = $response->json('data.id');
    Queue::assertNothingPushed();
    expect(AuditEvent::query()->where('action', 'report.export_scheduled')->where('subject_id', (string) $exportId)->exists())->toBeTrue();

    // Private to owner: another user does not see it in GET /reports/exports
    $other = createUserWithPermissions('Hendra Wijaya', 'manajer_gudang', ['barang.view']);
    Sanctum::actingAs($other);
    $this->getJson('/api/v1/reports/exports')->assertOk()->assertJsonCount(0, 'data');

    // Owner sees it in GET /reports/exports and ?status=scheduled
    Sanctum::actingAs($admin);
    $this->getJson('/api/v1/reports/exports?status=scheduled')->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $exportId)
        ->assertJsonPath('data.0.status', 'scheduled');

    // Before due time, scheduler does NOT run it
    $this->artisan('reports:process')->assertExitCode(0);
    expect(ReportExport::query()->findOrFail($exportId)->status)->toBe('scheduled');

    // When tomorrow 08:00 WIB arrives (01:00 UTC), scheduler promotes and processes it
    FakeSources::add('items', ['name' => 'Kain Katun', 'kind' => 'kain', 'quantity' => 50, 'unit' => 'm']);
    Carbon::setTestNow('2026-11-26 01:00:00');
    $this->artisan('reports:process')->assertExitCode(0);

    $done = ReportExport::query()->findOrFail($exportId);
    expect($done->status)->toBe('completed')
        ->and($done->row_count)->toBe(1)
        ->and(Storage::disk('local')->exists((string) $done->file_path))->toBeTrue();
});

it('schedules a recurring preset or cron export, spawns a downloadable child when due, and advances next run', function () {
    Queue::fake();
    actingAsRole('admin_it');

    // Daily at 08:00 Asia/Jakarta (01:00 UTC) from 2026-11-25 10:00 UTC -> next run is 2026-11-26 01:00 UTC
    $res = $this->postJson('/api/v1/reports/export', [
        'type' => 'audit',
        'format' => 'pdf',
        'name' => 'Audit Harian',
        'schedule_preset' => 'daily',
        'schedule_time' => '08:00',
        'timezone' => 'Asia/Jakarta',
    ])->assertStatus(202)
        ->assertJsonPath('data.status', 'scheduled')
        ->assertJsonPath('data.schedule_type', 'recurring')
        ->assertJsonPath('data.cron_expression', '0 8 * * *')
        ->assertJsonPath('data.scheduled_at', '2026-11-26T01:00:00Z');

    $parentId = $res->json('data.id');
    Queue::assertNothingPushed();

    // Advance to due time and run reports:process
    Carbon::setTestNow('2026-11-26 01:00:00');
    $this->artisan('reports:process')->assertExitCode(0);

    $parent = ReportExport::query()->findOrFail($parentId);
    expect($parent->status)->toBe('scheduled')
        ->and($parent->scheduled_at?->utc()->format('Y-m-d\TH:i:s\Z'))->toBe('2026-11-27T01:00:00Z');

    $child = ReportExport::query()->where('parent_export_id', $parentId)->sole();
    expect($child->status)->toBe('completed')
        ->and($child->schedule_type)->toBe('immediate')
        ->and($child->format)->toBe('pdf')
        ->and(Storage::disk('local')->exists((string) $child->file_path))->toBeTrue();

    // Download spawned child successfully
    $this->get("/api/v1/reports/exports/{$child->id}/download")->assertOk();
});

it('validates scheduling inputs including past timestamps, invalid cron, and conflicting schedule fields', function () {
    Queue::fake();
    actingAsRole('admin_it');

    // Past timestamp rejected
    assertApiError($this->postJson('/api/v1/reports/export', [
        'type' => 'audit',
        'format' => 'csv',
        'scheduled_at' => '2026-11-25T09:00:00Z',
    ]), 422, 'VALIDATION_ERROR');

    // Invalid cron expression rejected
    assertApiError($this->postJson('/api/v1/reports/export', [
        'type' => 'audit',
        'format' => 'csv',
        'cron_expression' => 'bukan-cron',
    ]), 422, 'VALIDATION_ERROR');

    // Conflicting scheduled_at + cron_expression rejected
    assertApiError($this->postJson('/api/v1/reports/export', [
        'type' => 'audit',
        'format' => 'csv',
        'scheduled_at' => '2026-11-26T08:00:00+07:00',
        'cron_expression' => '0 8 * * *',
    ]), 422, 'VALIDATION_ERROR');

    // Conflicting cron_expression + schedule_preset rejected
    assertApiError($this->postJson('/api/v1/reports/export', [
        'type' => 'audit',
        'format' => 'csv',
        'cron_expression' => '0 8 * * *',
        'schedule_preset' => 'weekly',
    ]), 422, 'VALIDATION_ERROR');
});

it('cancels a scheduled export before its due time so scheduler never runs it', function () {
    Queue::fake();
    $owner = createUserWithPermissions('Hendra Wijaya', 'manajer_gudang', ['barang.view']);
    $admin = actingAsRole('admin_it');

    Sanctum::actingAs($owner);
    $exportId = $this->postJson('/api/v1/reports/export', [
        'type' => 'barang',
        'format' => 'docx',
        'scheduled_at' => '2026-11-26T08:00:00+07:00',
    ])->assertStatus(202)->json('data.id');

    // Even Admin IT cannot cancel another user's ticket (owner-only rule)
    Sanctum::actingAs($admin);
    assertApiError($this->postJson("/api/v1/reports/exports/{$exportId}/cancel"), 403, 'FORBIDDEN');

    // Owner cancels successfully
    Sanctum::actingAs($owner);
    $this->postJson("/api/v1/reports/exports/{$exportId}/cancel")
        ->assertOk()
        ->assertJsonPath('data.status', 'cancelled')
        ->assertJsonPath('data.cancelled_at', '2026-11-25T10:00:00Z');

    expect(AuditEvent::query()->where('action', 'report.export_cancelled')->where('subject_id', (string) $exportId)->exists())->toBeTrue();

    // Cancelling again returns 409 CONFLICT
    assertApiError($this->postJson("/api/v1/reports/exports/{$exportId}/cancel"), 409, 'CONFLICT');

    // Even after scheduled time passes, scheduler never runs cancelled ticket
    Carbon::setTestNow('2026-11-26 02:00:00');
    $this->artisan('reports:process')->assertExitCode(0);
    expect(ReportExport::query()->findOrFail($exportId)->status)->toBe('cancelled')
        ->and(ReportExport::query()->findOrFail($exportId)->file_path)->toBeNull();
});

it('cancels a pending immediate export and purges its queued job from the jobs table', function () {
    $owner = actingAsRole('admin_it');

    // Create two pending tickets and insert corresponding database queue rows in `jobs`
    $exportA = ReportExport::query()->create([
        'user_id' => $owner->id,
        'requester_role' => 'admin_it',
        'type' => 'audit',
        'name' => 'Audit A',
        'format' => 'csv',
        'status' => ReportExport::STATUS_PENDING,
    ]);
    $exportB = ReportExport::query()->create([
        'user_id' => $owner->id,
        'requester_role' => 'admin_it',
        'type' => 'audit',
        'name' => 'Audit B',
        'format' => 'csv',
        'status' => ReportExport::STATUS_PENDING,
    ]);

    foreach ([$exportA, $exportB] as $item) {
        DB::table('jobs')->insert([
            'queue' => 'exports',
            'payload' => json_encode([
                'displayName' => ProcessReportExport::class,
                'data' => [
                    'commandName' => ProcessReportExport::class,
                    'command' => serialize(new ProcessReportExport($item->id)),
                ],
            ], JSON_THROW_ON_ERROR),
            'attempts' => 0,
            'reserved_at' => null,
            'available_at' => now()->timestamp,
            'created_at' => now()->timestamp,
        ]);
    }

    expect(DB::table('jobs')->where('queue', 'exports')->count())->toBe(2);

    $this->postJson("/api/v1/reports/exports/{$exportA->id}/cancel")
        ->assertOk()
        ->assertJsonPath('data.status', 'cancelled');

    // Only exportA's queued job was removed; exportB's job remains intact
    expect(DB::table('jobs')->where('queue', 'exports')->count())->toBe(1)
        ->and(app(ReportExportProcessor::class)->claimAndProcess($exportA->id))->toBeFalse();

    // Processing or completed tickets cannot be cancelled -> 409 CONFLICT
    app(ReportExportProcessor::class)->claimAndProcess($exportB->id);
    assertApiError($this->postJson("/api/v1/reports/exports/{$exportB->id}/cancel"), 409, 'CONFLICT');
});

it('auto-cancels due scheduled exports if owner becomes inactive and protects active schedules from reports:prune', function () {
    Queue::fake();
    $user = createUserWithPermissions('Hendra Wijaya', 'manajer_gudang', ['barang.view']);
    Sanctum::actingAs($user);

    $recurringId = $this->postJson('/api/v1/reports/export', [
        'type' => 'barang',
        'format' => 'csv',
        'cron_expression' => '0 8 * * 1',
        'timezone' => 'Asia/Jakarta',
    ])->assertStatus(202)->json('data.id');

    // Age record > 10 days: reports:prune must NOT delete an active scheduled ticket
    ReportExport::query()->whereKey($recurringId)->update(['created_at' => now()->subDays(10)]);
    $this->artisan('reports:prune', ['--days' => 7])->assertExitCode(0);
    expect(ReportExport::query()->find($recurringId))->not->toBeNull();

    // Deactivate owner; when due, scheduler auto-cancels instead of running
    $user->update(['is_active' => false]);
    $dueAt = ReportExport::query()->findOrFail($recurringId)->scheduled_at;
    Carbon::setTestNow($dueAt->copy()->addMinute());
    $this->artisan('reports:process')->assertExitCode(0);

    $after = ReportExport::query()->findOrFail($recurringId);
    expect($after->status)->toBe('cancelled')
        ->and(ReportExport::query()->where('parent_export_id', $recurringId)->count())->toBe(0);
});
