<?php

use App\Jobs\ProcessDataImportChunk;
use App\Models\AuditEvent;
use App\Models\Console;
use App\Models\DataImport;
use App\Models\Role;
use App\Models\User;
use App\Services\Imports\ImportExecutionService;
use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    Carbon::setTestNow('2026-11-27 10:00:00');
    fakeSources();
});

function makeCsvUpload(string $filename, array $rows): UploadedFile
{
    $handle = fopen('php://temp', 'r+b');
    foreach ($rows as $row) {
        fputcsv($handle, $row, ',', '"', '');
    }
    rewind($handle);
    $content = (string) stream_get_contents($handle);
    fclose($handle);

    return UploadedFile::fake()->createWithContent($filename, $content);
}

it('downloads official CSV and XLSX templates and enforces RBAC permissions', function () {
    $user = createUserWithPermissions('Staff Gudang', 'gudang_create_only', ['barang.create']);
    Sanctum::actingAs($user);

    $csvRes = $this->get('/api/v1/imports/templates/barang?format=csv')->assertOk();
    expect(str_starts_with((string) $csvRes->getContent(), "\xEF\xBB\xBF"))->toBeTrue()
        ->and((string) $csvRes->getContent())->toContain('id,name,kind,production,responsible,quantity,unit');

    $xlsxRes = $this->get('/api/v1/imports/templates/barang?format=xlsx')->assertOk();
    expect(str_starts_with((string) $xlsxRes->getContent(), "PK\x03\x04"))->toBeTrue();

    assertApiError($this->getJson('/api/v1/imports/templates/users?format=csv'), 403, 'FORBIDDEN');
    assertApiError($this->getJson('/api/v1/imports/templates/personel?format=csv'), 403, 'FORBIDDEN');
});

it('completes preview and commit for users with self-lockout guard, anti-zombie, and name+role update', function () {
    $admin = actingAsRole('admin_it');
    $userRole = Role::query()->firstOrCreate(['code' => 'user'], ['name' => 'User']);

    $activeUser = User::factory()->create([
        'name' => 'Nama Lama',
        'email' => 'aktif@example.com',
        'role_id' => $userRole->id,
        'is_active' => true,
        'updated_at' => now()->subMinute(),
    ]);

    $inactiveUser = User::factory()->create([
        'name' => 'Nonaktif User',
        'email' => 'mati@example.com',
        'role_id' => $userRole->id,
        'is_active' => false,
    ]);

    // First test invalid self-lockout row blocks commit
    $badFile = makeCsvUpload('users-bad.csv', [
        ['name', 'email', 'role_code'],
        [$admin->name, $admin->email, 'user'],
    ]);

    $badPreview = $this->post('/api/v1/imports/preview', [
        'type' => 'users',
        'mode' => 'upsert',
        'file' => $badFile,
    ])->assertStatus(201);

    $badPreview->assertJsonPath('data.invalid_count', 1)
        ->assertJsonPath('data.plan_rows.0.action', 'invalid');

    assertApiError($this->postJson('/api/v1/imports/'.$badPreview->json('data.id').'/commit'), 422, 'VALIDATION_ERROR');

    // Valid upload: 1 create, 1 update (name + role), 1 skip (inactive anti-zombie)
    $file = makeCsvUpload('users-good.csv', [
        ['name', 'email', 'role_code'],
        ['Pengguna Baru', 'baru@example.com', 'user'],
        ['Nama Baru', 'aktif@example.com', 'admin_it'],
        ['Tidak Boleh Aktif', 'mati@example.com', 'user'],
    ]);

    $preview = $this->post('/api/v1/imports/preview', [
        'type' => 'users',
        'mode' => 'upsert',
        'file' => $file,
    ])->assertStatus(201);

    $importId = $preview->json('data.id');
    $preview->assertJsonPath('data.create_count', 1)
        ->assertJsonPath('data.update_count', 1)
        ->assertJsonPath('data.skip_count', 1)
        ->assertJsonPath('data.invalid_count', 0);

    $this->postJson("/api/v1/imports/{$importId}/commit")->assertStatus(202);

    $detail = $this->getJson("/api/v1/imports/{$importId}")->assertOk();
    $detail->assertJsonPath('data.status', 'completed')
        ->assertJsonPath('data.created_count', 1)
        ->assertJsonPath('data.updated_count', 1)
        ->assertJsonPath('data.skipped_count', 1)
        ->assertJsonPath('data.failed_count', 0);

    $createdUser = User::query()->where('email', 'baru@example.com')->first();
    expect($createdUser)->not->toBeNull()
        ->and($createdUser?->password)->toBeNull()
        ->and($createdUser?->is_active)->toBeTrue();

    $activeUser->refresh();
    expect($activeUser->name)->toBe('Nama Baru')
        ->and($activeUser->role->code)->toBe('admin_it');

    $inactiveUser->refresh();
    expect($inactiveUser->is_active)->toBeFalse();
    expect(AuditEvent::query()->where('action', 'import.completed')->where('subject_id', (string) $importId)->exists())->toBeTrue();
});

it('executes personel, produksi, and barang imports with zero-ambiguity, anti-zombie, and keeping blank optional fields on upsert', function () {
    actingAsRole('admin_it');

    // Personel: 1 active, 1 inactive
    $sari = FakeSources::add('people', ['name' => 'Sari', 'role' => 'Kurir', 'status' => 'aktif']);
    FakeSources::add('people', ['name' => 'Mantan', 'role' => 'Kurir', 'status' => 'nonaktif']);

    // 1. Personel upsert: update by ID, skip without ID (potential duplicate), skip inactive by natural key, create new
    $pFile = makeCsvUpload('personel.csv', [
        ['id', 'name', 'role'],
        [$sari['id'], 'Sari Updated', 'Kurir Senior'],
        ['', 'Sari', 'Kurir'], // matches if we check after update? wait: snapshot has Sari/Kurir -> skip potential duplicate!
        ['', 'Mantan', 'Kurir'], // nonaktif -> skip anti-zombie
        ['', 'Andi', 'Operator'], // new -> create
    ]);

    $pPreview = $this->post('/api/v1/imports/preview', ['type' => 'personel', 'mode' => 'upsert', 'file' => $pFile])->assertStatus(201);
    $pPreview->assertJsonPath('data.update_count', 1)
        ->assertJsonPath('data.skip_count', 2)
        ->assertJsonPath('data.create_count', 1);

    $this->postJson('/api/v1/imports/'.$pPreview->json('data.id').'/commit')->assertStatus(202);
    expect(FakeSources::$rows['people'][$sari['id']]['name'])->toBe('Sari Updated')
        ->and(FakeSources::$rows['people'])->toHaveCount(3);

    // 2. Produksi upsert: keeps existing courier_id when courier cell is left blank!
    $prodA = FakeSources::add('productions', ['area' => 'Area A', 'production_type' => 'Tenun', 'courier_id' => $sari['id'], 'status' => 'aktif']);
    $prodFile = makeCsvUpload('produksi.csv', [
        ['id', 'area', 'production_type', 'courier'],
        [$prodA['id'], 'Area A1', 'Tenun', ''], // blank courier must KEEP $sari['id']!
        ['', 'Area B', 'Jahit', 'Andi · Operator'], // hybrid lookup
    ]);
    $prodPreview = $this->post('/api/v1/imports/preview', ['type' => 'produksi', 'mode' => 'upsert', 'file' => $prodFile])->assertStatus(201);
    $prodPreview->assertJsonPath('data.update_count', 1)->assertJsonPath('data.create_count', 1);
    $this->postJson('/api/v1/imports/'.$prodPreview->json('data.id').'/commit')->assertStatus(202);

    expect(FakeSources::$rows['productions'][$prodA['id']]['area'])->toBe('Area A1')
        ->and(FakeSources::$rows['productions'][$prodA['id']]['courier_id'])->toBe($sari['id']);

    // 3. Barang upsert: keeps existing production/responsible/quantity/unit when blank!
    $existingItem = FakeSources::add('items', [
        'name' => 'Kain Katun',
        'kind' => 'kain',
        'production_id' => $prodA['id'],
        'responsible_id' => $sari['id'],
        'quantity' => 75,
        'unit' => 'm',
        'status' => 'aktif',
    ]);

    $bFile = makeCsvUpload('barang.csv', [
        ['id', 'name', 'kind', 'production', 'responsible', 'quantity', 'unit'],
        [$existingItem['id'], 'Kain Katun Premium', 'kain', '', '', '', ''], // only name changes!
        ['', 'Benang Baru', 'benang', 'Area B · Jahit', 'Andi', '0', 'roll'], // explicit 0 quantity!
    ]);

    $bPreview = $this->post('/api/v1/imports/preview', ['type' => 'barang', 'mode' => 'upsert', 'file' => $bFile])->assertStatus(201);
    $bPreview->assertJsonPath('data.update_count', 1)->assertJsonPath('data.create_count', 1);
    $this->postJson('/api/v1/imports/'.$bPreview->json('data.id').'/commit')->assertStatus(202);

    $updatedItem = FakeSources::$rows['items'][$existingItem['id']];
    expect($updatedItem['name'])->toBe('Kain Katun Premium')
        ->and($updatedItem['production_id'])->toBe($prodA['id'])
        ->and($updatedItem['responsible_id'])->toBe($sari['id'])
        ->and($updatedItem['quantity'])->toBe(75)
        ->and($updatedItem['unit'])->toBe('m');

    $createdItem = collect(FakeSources::$rows['items'])->firstWhere('name', 'Benang Baru');
    expect($createdItem)->not->toBeNull()
        ->and($createdItem['quantity'])->toBe(0)
        ->and($createdItem['unit'])->toBe('roll');
});

it('enforces per-resource lock (409 RESOURCE_LOCKED), cross-user privacy, and parallel different-entity imports', function () {
    Queue::fake();
    $userA = createUserWithPermissions('User A', 'role_a', ['personel.create', 'barang.create']);
    $userB = createUserWithPermissions('User B', 'role_b', ['personel.create', 'barang.create']);

    // User A starts personel import
    Sanctum::actingAs($userA);
    $fileA = makeCsvUpload('personel-a.csv', [['id', 'name', 'role'], ['', 'A1', 'Kurir']]);
    $impA = $this->post('/api/v1/imports/preview', ['type' => 'personel', 'mode' => 'create_only', 'file' => $fileA])->assertStatus(201)->json('data.id');
    $this->postJson("/api/v1/imports/{$impA}/commit")->assertStatus(202);

    // User B tries to commit personel -> 409 RESOURCE_LOCKED
    Sanctum::actingAs($userB);
    $fileB = makeCsvUpload('personel-b.csv', [['id', 'name', 'role'], ['', 'B1', 'Kurir']]);
    $impB = $this->post('/api/v1/imports/preview', ['type' => 'personel', 'mode' => 'create_only', 'file' => $fileB])->assertStatus(201)->json('data.id');

    $lockedRes = $this->postJson("/api/v1/imports/{$impB}/commit");
    assertApiError($lockedRes, 409, 'CONFLICT');
    $lockedRes->assertJsonPath('error.details.reason', 'RESOURCE_LOCKED')
        ->assertJsonPath('error.details.active_import.requester_name', 'User A')
        ->assertJsonPath('error.details.active_import.is_mine', false);

    // User B lists imports: sees active lock metadata only (no filename/rows leaked), and cannot view User A ticket
    $listB = $this->getJson('/api/v1/imports')->assertOk();
    $listB->assertJsonPath('meta.active_locks.personel.requester_name', 'User A')
        ->assertJsonPath('meta.active_locks.personel.is_mine', false)
        ->assertJsonMissing(['original_filename' => 'personel-a.csv']);
    expect(array_keys($listB->json('meta.active_locks.personel')))->toBe([
        'id', 'type', 'status', 'requester_name', 'processed_rows', 'total_rows', 'started_at', 'is_mine',
    ]);
    assertApiError($this->getJson("/api/v1/imports/{$impA}"), 403, 'FORBIDDEN');

    // User B CAN import barang in parallel!
    $fileBarang = makeCsvUpload('barang-b.csv', [
        ['id', 'name', 'kind', 'production', 'responsible', 'quantity', 'unit'],
        ['', 'Barang Paralel', 'kain', '', '', '5', 'pcs'],
    ]);
    $impBarang = $this->post('/api/v1/imports/preview', ['type' => 'barang', 'mode' => 'create_only', 'file' => $fileBarang])->assertStatus(201)->json('data.id');
    $this->postJson("/api/v1/imports/{$impBarang}/commit")->assertStatus(202);
});

it('detects stale preview (409 STALE_PREVIEW) and supports 1-click revalidate', function () {
    $userA = createUserWithPermissions('User A', 'role_a2', ['personel.create']);
    $userB = createUserWithPermissions('User B', 'role_b2', ['personel.create']);

    Sanctum::actingAs($userA);
    $fileA = makeCsvUpload('a.csv', [['id', 'name', 'role'], ['', 'Rina', 'Kurir']]);
    $impA = $this->post('/api/v1/imports/preview', ['type' => 'personel', 'mode' => 'create_only', 'file' => $fileA])->assertStatus(201)->json('data.id');

    // 10 seconds later User B previews & completes an import creating ('Rina', 'Kurir')
    Carbon::setTestNow('2026-11-27 10:00:10');
    Sanctum::actingAs($userB);
    $fileB = makeCsvUpload('b.csv', [['id', 'name', 'role'], ['', 'Rina', 'Kurir']]);
    $impB = $this->post('/api/v1/imports/preview', ['type' => 'personel', 'mode' => 'create_only', 'file' => $fileB])->assertStatus(201)->json('data.id');
    $this->postJson("/api/v1/imports/{$impB}/commit")->assertStatus(202);

    // User A attempts commit -> 409 STALE_PREVIEW
    Sanctum::actingAs($userA);
    $staleRes = $this->postJson("/api/v1/imports/{$impA}/commit");
    assertApiError($staleRes, 409, 'CONFLICT');
    $staleRes->assertJsonPath('error.details.reason', 'STALE_PREVIEW');

    // User A clicks Revalidate -> now sees ('Rina', 'Kurir') skipped as already registered, then commits cleanly!
    $revalidated = $this->postJson("/api/v1/imports/{$impA}/revalidate")->assertOk();
    $revalidated->assertJsonPath('data.create_count', 0)
        ->assertJsonPath('data.skip_count', 1)
        ->assertJsonPath('data.plan_rows.0.action', 'skip');

    $this->postJson("/api/v1/imports/{$impA}/commit")->assertStatus(202);
});

it('records runtime 409 VERSION_CONFLICT without overwriting and streams CSV error report with formula protection', function () {
    actingAsRole('admin_it');
    $sari = FakeSources::add('people', ['name' => 'Sari', 'role' => 'Kurir', 'status' => 'aktif']);

    $file = makeCsvUpload('conflict.csv', [
        ['id', 'name', 'role'],
        [$sari['id'], '=HYPERLINK("evil")', 'Kurir'],
    ]);

    $preview = $this->post('/api/v1/imports/preview', ['type' => 'personel', 'mode' => 'upsert', 'file' => $file])->assertStatus(201);
    $importId = $preview->json('data.id');

    // Simulate concurrent edit bumping version 1 -> 2 before worker runs
    FakeSources::$rows['people'][$sari['id']]['version'] = 2;
    FakeSources::$rows['people'][$sari['id']]['name'] = 'Sari Edited Elsewhere';

    $this->postJson("/api/v1/imports/{$importId}/commit")->assertStatus(202);

    $detail = $this->getJson("/api/v1/imports/{$importId}")->assertOk();
    $detail->assertJsonPath('data.status', 'completed')
        ->assertJsonPath('data.updated_count', 0)
        ->assertJsonPath('data.failed_count', 1)
        ->assertJsonPath('data.execution_results.0.status', 'conflict');

    expect(FakeSources::$rows['people'][$sari['id']]['name'])->toBe('Sari Edited Elsewhere');

    $report = $this->get("/api/v1/imports/{$importId}/report?scope=errors")->assertOk();
    expect((string) $report->getContent())->toContain("'=HYPERLINK")
        ->and((string) $report->getContent())->toContain('conflict');
});

it('handles 429 Retry-After backoff, 3 consecutive unreachable failures, and cooperative cancellation', function () {
    Queue::fake();
    $user = actingAsRole('admin_it');

    // 1. Test 429 Retry-After backoff reschedules at exact cursor
    $console = Console::query()->where('slug', 'hr')->firstOrFail();
    Http::swap(new HttpFactory);
    Http::preventStrayRequests();
    Http::fake([
        "{$console->base_url}/api/v1/people?*" => Http::response(['data' => [], 'meta' => ['next_cursor' => null]], 200),
        "{$console->base_url}/api/v1/people" => Http::sequence()
            ->push(['error' => ['code' => 'RATE_LIMITED', 'message' => 'Too many requests']], 429, ['Retry-After' => '22'])
            ->push(['data' => ['id' => '99999999-9999-4999-8999-999999999999', 'name' => 'Budi', 'role' => 'Kurir', 'status' => 'aktif', 'version' => 1]], 201),
    ]);

    $file429 = makeCsvUpload('retry429.csv', [['id', 'name', 'role'], ['', 'Budi', 'Kurir']]);
    $imp429Id = $this->post('/api/v1/imports/preview', ['type' => 'personel', 'mode' => 'create_only', 'file' => $file429])->assertStatus(201)->json('data.id');
    $this->postJson("/api/v1/imports/{$imp429Id}/commit")->assertStatus(202);

    // Run chunk 1 manually: hits 429 -> pauses and pushes delayed job with backoffAttempt=1
    (new ProcessDataImportChunk($imp429Id))->handle(app(ImportExecutionService::class));

    Queue::assertPushed(ProcessDataImportChunk::class, function (ProcessDataImportChunk $job) use ($imp429Id) {
        return $job->importId === $imp429Id && $job->backoffAttempt === 1 && $job->delay !== null;
    });

    // Run rescheduled chunk: succeeds and sends X-Acting-User header!
    (new ProcessDataImportChunk($imp429Id, 1))->handle(app(ImportExecutionService::class));
    expect(DataImport::query()->findOrFail($imp429Id)->status)->toBe('completed');
    Http::assertSent(fn (Request $req) => $req->method() === 'POST' && $req->header('X-Acting-User') === [(string) $user->id]);

    // 2. Test cooperative cancel while processing keeps lock until worker exits cleanly
    $fileCancel = makeCsvUpload('cancel.csv', [
        ['id', 'name', 'role'],
        ['', 'Satu', 'Kurir'],
        ['', 'Dua', 'Kurir'],
    ]);
    $impCancelId = $this->post('/api/v1/imports/preview', ['type' => 'personel', 'mode' => 'create_only', 'file' => $fileCancel])->assertStatus(201)->json('data.id');
    $this->postJson("/api/v1/imports/{$impCancelId}/commit")->assertStatus(202);

    // Simulate job picked up (status = processing), then user clicks cancel
    DataImport::query()->whereKey($impCancelId)->update(['status' => 'processing']);
    $cancelRes = $this->postJson("/api/v1/imports/{$impCancelId}/cancel")->assertOk();
    $cancelRes->assertJsonPath('data.status', 'processing')
        ->assertJsonPath('data.cancel_requested', true);

    // Next chunk/row sees cancel_requested_at and transitions cleanly to cancelled (releasing lock)
    (new ProcessDataImportChunk($impCancelId))->handle(app(ImportExecutionService::class));
    expect(DataImport::query()->findOrFail($impCancelId)->status)->toBe('cancelled');

    // 3. Test 3 consecutive unreachable errors stop import & release lock
    Http::swap(new HttpFactory);
    Http::preventStrayRequests();
    Http::fake([
        "{$console->base_url}/api/v1/people?*" => Http::response(['data' => [], 'meta' => ['next_cursor' => null]], 200),
        "{$console->base_url}/api/v1/people" => fn () => Http::failedConnection()(new Request(new GuzzleHttp\Psr7\Request('POST', $console->base_url))),
    ]);

    $fileDown = makeCsvUpload('down.csv', [
        ['id', 'name', 'role'],
        ['', 'A', 'Kurir'],
        ['', 'B', 'Kurir'],
        ['', 'C', 'Kurir'],
        ['', 'D', 'Kurir'],
    ]);
    $impDownId = $this->post('/api/v1/imports/preview', ['type' => 'personel', 'mode' => 'create_only', 'file' => $fileDown])->assertStatus(201)->json('data.id');
    $this->postJson("/api/v1/imports/{$impDownId}/commit")->assertStatus(202);
    (new ProcessDataImportChunk($impDownId))->handle(app(ImportExecutionService::class));

    $failedImport = DataImport::query()->findOrFail($impDownId);
    expect($failedImport->status)->toBe('failed')
        ->and($failedImport->failed_count)->toBe(3)
        ->and($failedImport->processed_rows)->toBe(3);
});

it('enforces create-only vs upsert permissions and purges jobs on queued cancellation', function () {
    $createOnlyUser = createUserWithPermissions('Creator', 'barang_creator', ['barang.create']);
    Sanctum::actingAs($createOnlyUser);

    $file = makeCsvUpload('b.csv', [
        ['id', 'name', 'kind', 'production', 'responsible', 'quantity', 'unit'],
        ['', 'Meja', 'kayu', '', '', '10', 'pcs'],
    ]);

    // Upsert requires barang.update as well -> 403
    assertApiError($this->post('/api/v1/imports/preview', ['type' => 'barang', 'mode' => 'upsert', 'file' => $file]), 403, 'FORBIDDEN');

    // Create-only allowed, queued then cancelled cleanly
    config(['queue.default' => 'database']);
    $preview = $this->post('/api/v1/imports/preview', ['type' => 'barang', 'mode' => 'create_only', 'file' => $file])->assertStatus(201);
    $id = $preview->json('data.id');
    $this->postJson("/api/v1/imports/{$id}/commit")->assertStatus(202);

    expect(DB::table('jobs')->where('queue', 'default')->count())->toBe(1);

    $this->postJson("/api/v1/imports/{$id}/cancel")->assertOk()
        ->assertJsonPath('data.status', 'cancelled');

    expect(DB::table('jobs')->where('queue', 'default')->count())->toBe(0);
    expect(AuditEvent::query()->where('action', 'import.cancelled')->where('subject_id', (string) $id)->exists())->toBeTrue();
});

it('recovers stuck processing imports in imports:process and expires/prunes old imports in imports:prune', function () {
    $user = actingAsRole('admin_it');

    $stuck = DataImport::query()->create([
        'user_id' => $user->id,
        'type' => 'personel',
        'mode' => 'create_only',
        'status' => 'processing',
        'original_filename' => 'stuck.csv',
        'file_format' => 'csv',
        'started_at' => now()->subMinutes(15),
        'last_chunk_at' => now()->subMinutes(12),
    ]);

    $this->artisan('imports:process')->assertSuccessful();
    $stuck->refresh();
    expect($stuck->status)->toBe('failed');
    expect(AuditEvent::query()->where('action', 'import.failed')->where('subject_id', (string) $stuck->id)->exists())->toBeTrue();

    $oldPreview = DataImport::query()->create([
        'user_id' => $user->id,
        'type' => 'users',
        'mode' => 'create_only',
        'status' => 'preview',
        'original_filename' => 'old.csv',
        'file_format' => 'csv',
        'source_rows' => [['row_number' => 2, 'values' => ['name' => 'A', 'email' => 'a@example.com', 'role_code' => 'user']]],
        'plan_rows' => [['row_number' => 2, 'action' => 'create']],
    ]);
    DB::table('data_imports')->where('id', $oldPreview->id)->update(['created_at' => now()->subHours(25)]);

    $oldCompleted = DataImport::query()->create([
        'user_id' => $user->id,
        'type' => 'users',
        'mode' => 'create_only',
        'status' => 'completed',
        'original_filename' => 'done8d.csv',
        'file_format' => 'csv',
        'source_rows' => [['row_number' => 2, 'values' => []]],
        'plan_rows' => [['row_number' => 2, 'action' => 'create']],
        'completed_at' => now()->subDays(8),
    ]);
    DB::table('data_imports')->where('id', $oldCompleted->id)->update([
        'created_at' => now()->subDays(9),
        'updated_at' => now()->subDays(8),
    ]);

    $veryOld = DataImport::query()->create([
        'user_id' => $user->id,
        'type' => 'users',
        'mode' => 'create_only',
        'status' => 'completed',
        'original_filename' => 'done20d.csv',
        'file_format' => 'csv',
        'completed_at' => now()->subDays(20),
    ]);
    DB::table('data_imports')->where('id', $veryOld->id)->update(['created_at' => now()->subDays(20)]);

    $activeProcessing = DataImport::query()->create([
        'user_id' => $user->id,
        'type' => 'barang',
        'mode' => 'create_only',
        'status' => 'processing',
        'original_filename' => 'active.csv',
        'file_format' => 'csv',
        'last_chunk_at' => now(),
    ]);
    DB::table('data_imports')->where('id', $activeProcessing->id)->update(['created_at' => now()->subDays(20)]);

    $this->artisan('imports:prune')->assertSuccessful();

    expect($oldPreview->fresh()?->status)->toBe('expired')
        ->and($oldPreview->fresh()?->source_rows)->toBeNull()
        ->and($oldCompleted->fresh()?->source_rows)->toBeNull()
        ->and(DataImport::query()->find($veryOld->id))->toBeNull()
        ->and(DataImport::query()->find($activeProcessing->id))->not->toBeNull();
});
