<?php

use App\Jobs\ProcessReportExport;
use App\Models\AuditEvent;
use App\Models\Console;
use App\Models\LogEntry;
use App\Models\Permission;
use App\Models\ReportExport;
use App\Models\Role;
use App\Models\User;
use App\Services\Audit;
use App\Services\Reports\ReportExportProcessor;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    Carbon::setTestNow('2026-11-25 10:00:00');
    Storage::fake('local');
    fakeSources();
});

function createUserWithPermissions(string $name, string $roleCode, array $permissionCodes): User
{
    $role = Role::query()->firstOrCreate(['code' => $roleCode], ['name' => ucfirst(str_replace('_', ' ', $roleCode))]);
    $ids = collect($permissionCodes)->map(fn (string $code) => Permission::query()->firstOrCreate(
        ['code' => $code],
        ['description' => Permission::ALL[$code] ?? $code],
    )->id);
    $role->permissions()->sync($ids->all());

    return User::factory()->create([
        'name' => $name,
        'role_id' => $role->id,
    ]);
}

it('queues a pending export ticket, records audit, and dispatches job to exports queue', function () {
    Queue::fake();
    $admin = actingAsRole('admin_it');

    $response = $this->postJson('/api/v1/reports/export', [
        'type' => 'audit',
        'format' => 'csv',
        'name' => 'Laporan Audit (CSV)',
        'filters' => ['action' => 'item.created'],
    ]);

    $response->assertStatus(202)
        ->assertJsonPath('data.type', 'audit')
        ->assertJsonPath('data.format', 'csv')
        ->assertJsonPath('data.name', 'Laporan Audit (CSV)')
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.download_url', null)
        ->assertJsonPath('data.file_url', null)
        ->assertJsonPath('data.requester_role', 'admin_it')
        ->assertJsonPath('data.requester_name', $admin->name)
        ->assertJsonPath('data.is_mine', true)
        ->assertJsonPath('data.queue_position', 1);

    $exportId = $response->json('data.id');
    Queue::assertPushedOn('exports', ProcessReportExport::class, fn (ProcessReportExport $job) => $job->exportId === $exportId);
    expect(AuditEvent::query()->where('action', 'report.export_requested')->where('subject_id', (string) $exportId)->exists())->toBeTrue();
});

it('enforces RBAC permissions per export type and validates input', function () {
    Queue::fake();
    $warehouseUser = createUserWithPermissions('Hendra Wijaya', 'manajer_gudang', ['barang.view']);
    Sanctum::actingAs($warehouseUser);

    assertApiError($this->postJson('/api/v1/reports/export', ['type' => 'audit', 'format' => 'csv']), 403, 'FORBIDDEN');
    assertApiError($this->postJson('/api/v1/reports/export', ['type' => 'logs', 'format' => 'csv']), 403, 'FORBIDDEN');
    $this->postJson('/api/v1/reports/export', ['type' => 'barang', 'format' => 'csv'])->assertStatus(202);

    assertApiError($this->postJson('/api/v1/reports/export', ['type' => 'unknown', 'format' => 'pdf']), 422, 'VALIDATION_ERROR');

    $auditor = createUserWithPermissions('Dewi Lestari', 'auditor', ['admin.audit.view']);
    Sanctum::actingAs($auditor);
    $this->postJson('/api/v1/reports/export', ['type' => 'audit', 'format' => 'json'])->assertStatus(202);
    assertApiError($this->postJson('/api/v1/reports/export', ['type' => 'logs', 'format' => 'json']), 403, 'FORBIDDEN');
    assertApiError($this->postJson('/api/v1/reports/export', ['type' => 'barang', 'format' => 'json']), 403, 'FORBIDDEN');

    $hrOnly = createUserWithPermissions('Siti Rahma', 'staff_hr', ['personel.view']);
    Sanctum::actingAs($hrOnly);
    assertApiError($this->getJson('/api/v1/reports/exports'), 403, 'FORBIDDEN');
    assertApiError($this->postJson('/api/v1/reports/export', ['type' => 'barang', 'format' => 'csv']), 403, 'FORBIDDEN');
});

it('exposes shared active waiting list in FIFO order while keeping finished history private per user', function () {
    Queue::fake();
    $userA = createUserWithPermissions('Hendra Wijaya', 'manajer_gudang', ['barang.view']);
    $userB = actingAsRole('admin_it');
    $userB->update(['name' => 'Rina Wulandari']);

    // User A submits first -> #1
    Sanctum::actingAs($userA);
    $idA = $this->postJson('/api/v1/reports/export', ['type' => 'barang', 'format' => 'csv', 'name' => 'Barang A'])->assertStatus(202)->json('data.id');

    // User B submits second -> #2
    Sanctum::actingAs($userB);
    $idB = $this->postJson('/api/v1/reports/export', ['type' => 'audit', 'format' => 'json', 'name' => 'Audit B'])->assertStatus(202)->json('data.id');

    // User B sees both active tickets in FIFO order, with User A masked as not mine
    $listForB = $this->getJson('/api/v1/reports/exports')->assertOk();
    $listForB->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.id', $idA)
        ->assertJsonPath('data.0.requester_name', 'Hendra Wijaya')
        ->assertJsonPath('data.0.is_mine', false)
        ->assertJsonPath('data.0.queue_position', 1)
        ->assertJsonPath('data.0.download_url', null)
        ->assertJsonPath('data.1.id', $idB)
        ->assertJsonPath('data.1.requester_name', 'Rina Wulandari')
        ->assertJsonPath('data.1.is_mine', true)
        ->assertJsonPath('data.1.queue_position', 2);

    // Process User A's ticket to completion
    expect(app(ReportExportProcessor::class)->claimAndProcess($idA))->toBeTrue();

    // Now User B only sees their own active ticket (shifted to #1) and does NOT see User A's completed ticket
    $this->getJson('/api/v1/reports/exports')->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $idB)
        ->assertJsonPath('data.0.queue_position', 1);

    // User A sees User B's active ticket (#1) plus User A's own completed history
    Sanctum::actingAs($userA);
    $this->getJson('/api/v1/reports/exports')->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.id', $idB)
        ->assertJsonPath('data.0.is_mine', false)
        ->assertJsonPath('data.0.queue_position', 1)
        ->assertJsonPath('data.1.id', $idA)
        ->assertJsonPath('data.1.is_mine', true)
        ->assertJsonPath('data.1.status', 'completed')
        ->assertJsonPath('data.1.queue_position', null)
        ->assertJsonPath('data.1.download_url', "/reports/exports/{$idA}/download");
});

it('exports filtered audit data to CSV with UTF-8 BOM and formula injection protection', function () {
    Queue::fake();
    $admin = actingAsRole('admin_it');
    $admin->update(['name' => '=SUM(A1)']);
    $hr = Console::query()->where('slug', 'hr')->firstOrFail();

    app(Audit::class)->record('item.created', 'item', 'i-1', null, ['console' => 'gudang', 'name' => '+Formula']);
    app(Audit::class)->record('console.tested', 'console', (string) $hr->id, null, ['console' => 'hr', 'status' => 'ok']);

    $exportId = $this->postJson('/api/v1/reports/export', [
        'type' => 'audit',
        'format' => 'csv',
        'filters' => ['action' => 'item.created'],
    ])->assertStatus(202)->json('data.id');

    expect(app(ReportExportProcessor::class)->claimAndProcess($exportId))->toBeTrue();

    $export = ReportExport::query()->findOrFail($exportId);
    expect($export->status)->toBe('completed')
        ->and($export->row_count)->toBe(1)
        ->and(Storage::disk('local')->exists((string) $export->file_path))->toBeTrue();

    $download = $this->get("/api/v1/reports/exports/{$exportId}/download");
    $download->assertOk();
    expect($download->headers->get('content-type'))->toContain('text/csv')
        ->and($download->headers->get('content-disposition'))->toContain('attachment');

    $content = $download->streamedContent();
    expect(str_starts_with($content, "\xEF\xBB\xBF"))->toBeTrue()
        ->and($content)->toContain("'=SUM(A1)")
        ->and($content)->toContain('item.created')
        ->and($content)->not->toContain('console.tested');
});

it('exports filtered logs data to valid JSON', function () {
    Queue::fake();
    actingAsRole('admin_it');
    $gudang = Console::query()->where('slug', 'gudang')->firstOrFail();
    $hr = Console::query()->where('slug', 'hr')->firstOrFail();

    LogEntry::query()->create([
        'console_id' => $gudang->id,
        'occurred_at' => Carbon::parse('2026-11-25T09:00:00Z'),
        'level' => 'error',
        'message' => 'Stok gagal disinkronkan',
        'actor' => 'system',
        'fingerprint' => sha1('log-1'),
    ]);
    LogEntry::query()->create([
        'console_id' => $hr->id,
        'occurred_at' => Carbon::parse('2026-11-25T09:30:00Z'),
        'level' => 'info',
        'message' => 'Personel aktif',
        'actor' => 'hr-bot',
        'fingerprint' => sha1('log-2'),
    ]);

    $exportId = $this->postJson('/api/v1/reports/export', [
        'type' => 'logs',
        'format' => 'json',
        'filters' => [
            'console_id' => [(string) $gudang->id],
            'level' => ['error'],
            'q' => 'sinkron',
        ],
    ])->assertStatus(202)->json('data.id');

    app(ReportExportProcessor::class)->claimAndProcess($exportId);

    $download = $this->get("/api/v1/reports/exports/{$exportId}/download")->assertOk();
    expect($download->headers->get('content-type'))->toContain('application/json');

    $decoded = json_decode($download->streamedContent(), true, 512, JSON_THROW_ON_ERROR);
    expect($decoded)->toHaveCount(1)
        ->and($decoded[0]['console'])->toBe('Gudang')
        ->and($decoded[0]['level'])->toBe('error')
        ->and($decoded[0]['pesan'])->toBe('Stok gagal disinkronkan');
});

it('exports merged barang data from source HTTP APIs into a real XLSX workbook', function () {
    Queue::fake();
    $manager = createUserWithPermissions('Hendra Wijaya', 'manajer_gudang', ['barang.view']);
    Sanctum::actingAs($manager);

    $joko = FakeSources::add('people', ['name' => 'Joko Susilo', 'role' => 'Staf Gudang']);
    $tenun = FakeSources::add('productions', ['area' => 'Area Tekstil A', 'production_type' => 'Tenun', 'courier_id' => null]);
    FakeSources::add('items', [
        'name' => 'Kain Katun Premium',
        'kind' => 'kain',
        'production_id' => $tenun['id'],
        'responsible_id' => $joko['id'],
        'quantity' => 340,
        'unit' => 'm',
    ]);
    FakeSources::add('items', [
        'name' => 'Besi Hollow',
        'kind' => 'besi',
        'production_id' => null,
        'responsible_id' => null,
        'quantity' => 25,
        'unit' => 'batang',
    ]);

    $exportId = $this->postJson('/api/v1/reports/export', [
        'type' => 'barang',
        'format' => 'xlsx',
        'filters' => ['kind' => 'kain'],
    ])->assertStatus(202)->json('data.id');

    app(ReportExportProcessor::class)->claimAndProcess($exportId);

    $export = ReportExport::query()->findOrFail($exportId);
    expect($export->status)->toBe('completed')
        ->and($export->row_count)->toBe(1);

    $download = $this->get("/api/v1/reports/exports/{$exportId}/download")->assertOk();
    expect($download->headers->get('content-type'))->toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    $binary = $download->streamedContent();
    expect(str_starts_with($binary, 'PK'))->toBeTrue();

    $tmp = tempnam(sys_get_temp_dir(), 'xlsx_test_');
    file_put_contents($tmp, $binary);
    $zip = new ZipArchive;
    expect($zip->open($tmp))->toBeTrue();
    $xml = (string) $zip->getFromName('xl/worksheets/sheet1.xml').(string) $zip->getFromName('xl/sharedStrings.xml');
    $zip->close();
    @unlink($tmp);

    expect($xml)->toContain('Kain Katun Premium')
        ->and($xml)->toContain('Area Tekstil A')
        ->and($xml)->toContain('Joko Susilo')
        ->and($xml)->not->toContain('Besi Hollow');
});

it('guards download endpoint for ownership, RBAC, incomplete status, and missing file', function () {
    Queue::fake();
    $owner = createUserWithPermissions('Hendra Wijaya', 'manajer_gudang', ['barang.view']);
    $other = actingAsRole('admin_it');

    Sanctum::actingAs($owner);
    $exportId = $this->postJson('/api/v1/reports/export', ['type' => 'barang', 'format' => 'csv'])->assertStatus(202)->json('data.id');

    // Pending -> 409 CONFLICT
    assertApiError($this->get("/api/v1/reports/exports/{$exportId}/download"), 409, 'CONFLICT');

    // Process to completion
    app(ReportExportProcessor::class)->claimAndProcess($exportId);

    // Other user (even Admin IT) cannot download owner's private file -> 403 FORBIDDEN
    Sanctum::actingAs($other);
    assertApiError($this->get("/api/v1/reports/exports/{$exportId}/download"), 403, 'FORBIDDEN');

    // File deleted on disk -> 404 NOT_FOUND for owner
    Sanctum::actingAs($owner);
    $export = ReportExport::query()->findOrFail($exportId);
    Storage::disk('local')->delete((string) $export->file_path);
    assertApiError($this->get("/api/v1/reports/exports/{$exportId}/download"), 404, 'NOT_FOUND');
});

it('marks export failed with safe error message when source console is down', function () {
    Queue::fake();
    $manager = createUserWithPermissions('Hendra Wijaya', 'manajer_gudang', ['barang.view']);
    Sanctum::actingAs($manager);

    $exportId = $this->postJson('/api/v1/reports/export', ['type' => 'barang', 'format' => 'csv'])->assertStatus(202)->json('data.id');
    FakeSources::$down = ['gudang'];

    app(ReportExportProcessor::class)->claimAndProcess($exportId);

    $export = ReportExport::query()->findOrFail($exportId);
    expect($export->status)->toBe('failed')
        ->and($export->file_path)->toBeNull()
        ->and($export->error_message)->not->toBeEmpty()
        ->and((string) $export->error_message)->not->toContain('test-key-')
        ->and((string) $export->error_message)->not->toContain('.test');
});

it('prevents double processing with atomic claim and processes FIFO queue via scheduler command', function () {
    Queue::fake();
    $admin = actingAsRole('admin_it');

    $id1 = $this->postJson('/api/v1/reports/export', ['type' => 'audit', 'format' => 'csv'])->assertStatus(202)->json('data.id');
    $id2 = $this->postJson('/api/v1/reports/export', ['type' => 'logs', 'format' => 'json'])->assertStatus(202)->json('data.id');

    // Create a stuck processing ticket (> 15 minutes old)
    $stuck = ReportExport::query()->create([
        'user_id' => $admin->id,
        'requester_role' => 'admin_it',
        'type' => 'audit',
        'name' => 'Stuck Job',
        'format' => 'csv',
        'status' => ReportExport::STATUS_PROCESSING,
        'started_at' => now()->subMinutes(20),
    ]);

    $this->artisan('reports:process')->assertExitCode(0);

    expect(ReportExport::query()->findOrFail($id1)->status)->toBe('completed')
        ->and(ReportExport::query()->findOrFail($id2)->status)->toBe('completed')
        ->and(ReportExport::query()->findOrFail($stuck->id)->status)->toBe('failed')
        ->and(app(ReportExportProcessor::class)->claimAndProcess($id1))->toBeFalse();
});

it('prunes expired export files and records via reports:prune command', function () {
    Queue::fake();
    $admin = actingAsRole('admin_it');

    $oldId = $this->postJson('/api/v1/reports/export', ['type' => 'audit', 'format' => 'csv'])->assertStatus(202)->json('data.id');
    app(ReportExportProcessor::class)->claimAndProcess($oldId);
    $old = ReportExport::query()->findOrFail($oldId);
    $oldPath = (string) $old->file_path;
    ReportExport::query()->whereKey($oldId)->update(['created_at' => now()->subDays(10)]);

    $freshId = $this->postJson('/api/v1/reports/export', ['type' => 'audit', 'format' => 'csv'])->assertStatus(202)->json('data.id');
    app(ReportExportProcessor::class)->claimAndProcess($freshId);
    $fresh = ReportExport::query()->findOrFail($freshId);
    $freshPath = (string) $fresh->file_path;

    $this->artisan('reports:prune', ['--days' => 7])->assertExitCode(0);

    expect(ReportExport::query()->find($oldId))->toBeNull()
        ->and(Storage::disk('local')->exists($oldPath))->toBeFalse()
        ->and(ReportExport::query()->find($freshId))->not->toBeNull()
        ->and(Storage::disk('local')->exists($freshPath))->toBeTrue();
});
