<?php

namespace Tests\Feature;

use App\Models\AppLog;
use App\Models\Production;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PDOException;
use Tests\TestCase;

class ProductionsTest extends TestCase
{
    private string $serviceKey;

    protected function setUp(): void
    {
        parent::setUp();

        $this->serviceKey = (string) config('produksi.service_key');
    }

    public function test_lists_active_productions_by_default_with_envelope_and_structure(): void
    {
        $courierId = (string) Str::uuid();
        Production::query()->create([
            'area' => 'Area Tekstil A',
            'production_type' => 'Tenun',
            'courier_id' => $courierId,
            'status' => 'aktif',
            'version' => 1,
        ]);
        Production::query()->create([
            'area' => 'Area Logam B',
            'production_type' => 'Pengecoran',
            'courier_id' => null,
            'status' => 'aktif',
            'version' => 1,
        ]);
        Production::query()->create([
            'area' => 'Area Nonaktif',
            'production_type' => 'Pemotongan',
            'courier_id' => null,
            'status' => 'nonaktif',
            'version' => 1,
        ]);

        $response = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/productions');

        $response->assertOk()
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'area', 'production_type', 'courier_id', 'status', 'version', 'created_at', 'updated_at'],
                ],
                'meta' => ['next_cursor'],
            ])
            ->assertJsonCount(2, 'data');

        $areas = collect($response->json('data'))->pluck('area')->all();
        $this->assertContains('Area Tekstil A', $areas);
        $this->assertContains('Area Logam B', $areas);
        $this->assertNotContains('Area Nonaktif', $areas);
    }

    public function test_can_filter_productions_by_status_all_or_nonaktif_and_rejects_invalid_status(): void
    {
        Production::query()->create(['area' => 'Area Aktif', 'production_type' => 'Tenun', 'status' => 'aktif', 'version' => 1]);
        Production::query()->create(['area' => 'Area Nonaktif', 'production_type' => 'Cetak', 'status' => 'nonaktif', 'version' => 1]);

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/productions?status=all')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/productions?status=nonaktif')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.area', 'Area Nonaktif');

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/productions?status=invalid')
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['error' => ['details' => ['fields' => ['status']]]]);
    }

    public function test_filters_productions_by_production_type_courier_id_and_search_query_q(): void
    {
        $courierA = (string) Str::uuid();
        $courierB = (string) Str::uuid();

        Production::query()->create([
            'area' => 'Area Tekstil A',
            'production_type' => 'Tenun',
            'courier_id' => $courierA,
            'status' => 'aktif',
            'version' => 1,
        ]);
        Production::query()->create([
            'area' => 'Area Logam B',
            'production_type' => 'Pengecoran',
            'courier_id' => $courierB,
            'status' => 'aktif',
            'version' => 1,
        ]);
        Production::query()->create([
            'area' => 'Area Pangan',
            'production_type' => 'Tenun',
            'courier_id' => $courierA,
            'status' => 'aktif',
            'version' => 1,
        ]);

        // Filter by production_type
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/productions?production_type=Tenun')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        // Filter by courier_id
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson("/api/v1/productions?courier_id={$courierB}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.area', 'Area Logam B');

        // Invalid courier_id UUID returns 422
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/productions?courier_id=not-a-uuid')
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['error' => ['details' => ['fields' => ['courier_id']]]]);

        // Case-insensitive search on area via q
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/productions?q=tekstil')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.area', 'Area Tekstil A');

        // Case-insensitive search on production_type via q
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/productions?q=pengECORan')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.area', 'Area Logam B');
    }

    public function test_fetches_multiple_productions_by_ids_including_nonaktif_without_pagination(): void
    {
        $p1 = Production::query()->create(['area' => 'Area 1', 'production_type' => 'Tipe 1', 'status' => 'aktif', 'version' => 1]);
        $p2 = Production::query()->create(['area' => 'Area 2', 'production_type' => 'Tipe 2', 'status' => 'nonaktif', 'version' => 1]);
        $p3 = Production::query()->create(['area' => 'Area 3', 'production_type' => 'Tipe 3', 'status' => 'aktif', 'version' => 1]);

        $response = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson("/api/v1/productions?ids={$p1->id},{$p2->id}");

        $response->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.next_cursor', null);

        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($p1->id, $ids);
        $this->assertContains($p2->id, $ids);
        $this->assertNotContains($p3->id, $ids);

        // Empty ids returns empty list
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/productions?ids=')
            ->assertOk()
            ->assertJsonCount(0, 'data')
            ->assertJsonPath('meta.next_cursor', null);
    }

    public function test_rejects_ids_with_more_than_100_ids_with_422_validation_error(): void
    {
        $manyIds = implode(',', array_map(fn () => (string) Str::uuid(), range(1, 101)));

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson("/api/v1/productions?ids={$manyIds}")
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['error' => ['details' => ['fields' => ['ids']]]]);
    }

    public function test_supports_keyset_cursor_pagination_on_productions_list(): void
    {
        (new Production)->forceFill([
            'area' => 'Area 1',
            'production_type' => 'T1',
            'status' => 'aktif',
            'version' => 1,
            'created_at' => now()->subMinutes(3),
            'updated_at' => now()->subMinutes(3),
        ])->save();

        (new Production)->forceFill([
            'area' => 'Area 2',
            'production_type' => 'T2',
            'status' => 'aktif',
            'version' => 1,
            'created_at' => now()->subMinutes(2),
            'updated_at' => now()->subMinutes(2),
        ])->save();

        (new Production)->forceFill([
            'area' => 'Area 3',
            'production_type' => 'T3',
            'status' => 'aktif',
            'version' => 1,
            'created_at' => now()->subMinute(),
            'updated_at' => now()->subMinute(),
        ])->save();

        $firstPage = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/productions?limit=2');

        $firstPage->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.area', 'Area 3')
            ->assertJsonPath('data.1.area', 'Area 2');

        $nextCursor = $firstPage->json('meta.next_cursor');
        $this->assertIsString($nextCursor);
        $this->assertNotSame('', $nextCursor);

        $secondPage = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/productions?limit=2&cursor='.$nextCursor);

        $secondPage->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.area', 'Area 1')
            ->assertJsonPath('meta.next_cursor', null);

        // Invalid cursor returns 422
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/productions?cursor=bad-cursor')
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['error' => ['details' => ['fields' => ['cursor']]]]);
    }

    public function test_gets_single_production_detail_by_id_and_404s_on_missing_or_invalid_uuid(): void
    {
        $courierId = (string) Str::uuid();
        $production = Production::query()->create([
            'area' => 'Area Tekstil A',
            'production_type' => 'Tenun',
            'courier_id' => $courierId,
            'status' => 'aktif',
            'version' => 1,
        ]);

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson("/api/v1/productions/{$production->id}")
            ->assertOk()
            ->assertJson([
                'data' => [
                    'id' => $production->id,
                    'area' => 'Area Tekstil A',
                    'production_type' => 'Tenun',
                    'courier_id' => $courierId,
                    'status' => 'aktif',
                    'version' => 1,
                ],
            ]);

        $missingUuid = (string) Str::uuid();
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson("/api/v1/productions/{$missingUuid}")
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/productions/not-a-uuid')
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');
    }

    public function test_creates_production_via_post_with_version_1_status_aktif_and_logs_action(): void
    {
        $actor = 'admin-produksi-1';
        $requestId = 'req-trace-post-prod-1';
        $courierId = (string) Str::uuid(); // Any valid UUID, never checked against HR DB

        $response = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->withHeader('X-Acting-User', $actor)
            ->withHeader('X-Request-Id', $requestId)
            ->postJson('/api/v1/productions', [
                'area' => 'Area Tekstil A',
                'production_type' => 'Tenun',
                'courier_id' => $courierId,
            ]);

        $response->assertStatus(201)
            ->assertJson([
                'data' => [
                    'area' => 'Area Tekstil A',
                    'production_type' => 'Tenun',
                    'courier_id' => $courierId,
                    'status' => 'aktif',
                    'version' => 1,
                ],
            ])
            ->assertHeader('X-Request-Id', $requestId);

        $createdId = $response->json('data.id');
        $this->assertTrue(Production::query()->where('id', $createdId)->exists());

        $log = AppLog::query()->where('message', 'production.created')->latest('id')->first();
        $this->assertNotNull($log);
        $this->assertSame('info', $log->level);
        $this->assertSame($actor, $log->actor);
        $this->assertSame($requestId, $log->request_id);
        $this->assertSame($createdId, $log->context['production_id']);
    }

    public function test_creates_production_with_null_courier_id(): void
    {
        $response = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->postJson('/api/v1/productions', [
                'area' => 'Area Tekstil B',
                'production_type' => 'Pencelupan',
                'courier_id' => null,
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.courier_id', null)
            ->assertJsonPath('data.status', 'aktif')
            ->assertJsonPath('data.version', 1);
    }

    public function test_validates_post_payload_and_returns_422_validation_error(): void
    {
        $response = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->postJson('/api/v1/productions', [
                'area' => 'A', // min 2
                'courier_id' => 'invalid-uuid',
            ]);

        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonStructure([
                'error' => [
                    'code',
                    'message',
                    'details' => [
                        'fields' => ['area', 'production_type', 'courier_id'],
                    ],
                ],
            ]);
    }

    public function test_accepts_optional_id_on_post_and_rejects_duplicate_id_with_409_duplicate(): void
    {
        $customId = (string) Str::uuid();

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->postJson('/api/v1/productions', [
                'id' => $customId,
                'area' => 'Area Custom',
                'production_type' => 'Tipe Custom',
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.id', $customId);

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->postJson('/api/v1/productions', [
                'id' => $customId,
                'area' => 'Area Berbeda',
                'production_type' => 'Tipe Berbeda',
            ])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'DUPLICATE');
    }

    public function test_post_rejects_case_insensitive_duplicate_active_area_and_production_type_with_409_duplicate(): void
    {
        Production::query()->create([
            'area' => 'Area Tekstil A',
            'production_type' => 'Tenun',
            'status' => 'aktif',
            'version' => 1,
        ]);

        $requestId = 'req-trace-dup-post';

        $response = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->withHeader('X-Request-Id', $requestId)
            ->postJson('/api/v1/productions', [
                'area' => 'area tekstil a',
                'production_type' => 'TENUN',
            ]);

        $response->assertStatus(409)
            ->assertJsonPath('error.code', 'DUPLICATE')
            ->assertHeader('X-Request-Id', $requestId);

        $log = AppLog::query()->where('request_id', $requestId)->latest('id')->first();
        $this->assertNotNull($log);
        $this->assertSame('warn', $log->level);
        $this->assertSame('DUPLICATE', $log->context['code'] ?? null);
    }

    public function test_post_allows_duplicate_area_and_production_type_when_previous_record_is_nonaktif(): void
    {
        Production::query()->create([
            'area' => 'Area Tekstil A',
            'production_type' => 'Tenun',
            'status' => 'nonaktif',
            'version' => 2,
        ]);

        $response = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->postJson('/api/v1/productions', [
                'area' => 'area tekstil a',
                'production_type' => 'TENUN',
            ]);

        $response->assertStatus(201)
            ->assertJson([
                'data' => [
                    'area' => 'area tekstil a',
                    'production_type' => 'TENUN',
                    'status' => 'aktif',
                    'version' => 1,
                ],
            ]);

        $this->assertSame(2, Production::query()->count());
    }

    public function test_post_handles_postgresql_23505_unique_violation_race_condition_as_409_duplicate(): void
    {
        $triggered = false;

        DB::connection()->beforeExecuting(function (string $query) use (&$triggered): void {
            if (! $triggered && str_starts_with(strtolower(ltrim($query)), 'insert into "productions"')) {
                $triggered = true;
                $pdoException = new PDOException(
                    'SQLSTATE[23505]: Unique violation: 7 ERROR: duplicate key value violates unique constraint "productions_active_unique"',
                    23505
                );
                $pdoException->errorInfo = [
                    '23505',
                    7,
                    'ERROR: duplicate key value violates unique constraint "productions_active_unique"',
                ];

                throw new QueryException('pgsql', $query, [], $pdoException);
            }
        });

        $response = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->postJson('/api/v1/productions', [
                'area' => 'Area Race Condition',
                'production_type' => 'Tenun',
            ]);

        $this->assertTrue($triggered);
        $response->assertStatus(409)
            ->assertJsonPath('error.code', 'DUPLICATE');
    }

    public function test_post_handles_database_unique_index_race_condition_end_to_end(): void
    {
        $injected = false;

        DB::connection()->beforeExecuting(function (string $query) use (&$injected): void {
            if (! $injected && str_starts_with(strtolower(ltrim($query)), 'insert into "productions"')) {
                $injected = true;
                DB::table('productions')->insert([
                    'id' => (string) Str::uuid(),
                    'area' => 'AREA REAL RACE',
                    'production_type' => 'tenun',
                    'courier_id' => null,
                    'status' => 'aktif',
                    'version' => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        });

        $response = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->postJson('/api/v1/productions', [
                'area' => 'Area Real Race',
                'production_type' => 'Tenun',
            ]);

        $this->assertTrue($injected);
        $response->assertStatus(409)
            ->assertJsonPath('error.code', 'DUPLICATE');
    }

    public function test_updates_production_via_patch_increments_version_supports_unassigning_courier_and_logs(): void
    {
        $courierId = (string) Str::uuid();
        $production = Production::query()->create([
            'area' => 'Area Lama',
            'production_type' => 'Jenis Lama',
            'courier_id' => $courierId,
            'status' => 'aktif',
            'version' => 2,
        ]);

        $actor = 'editor-produksi';
        $requestId = 'req-trace-patch-1';

        // Update area only — courier_id remains unchanged
        $response = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->withHeader('X-Acting-User', $actor)
            ->withHeader('X-Request-Id', $requestId)
            ->patchJson("/api/v1/productions/{$production->id}", [
                'area' => 'Area Baru',
                'expected_version' => 2,
            ]);

        $response->assertOk()
            ->assertJson([
                'data' => [
                    'id' => $production->id,
                    'area' => 'Area Baru',
                    'production_type' => 'Jenis Lama',
                    'courier_id' => $courierId,
                    'version' => 3,
                ],
            ])
            ->assertHeader('X-Request-Id', $requestId);

        // Unassign courier via courier_id: null
        $unassignResponse = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->patchJson("/api/v1/productions/{$production->id}", [
                'courier_id' => null,
                'expected_version' => 3,
            ]);

        $unassignResponse->assertOk()
            ->assertJsonPath('data.courier_id', null)
            ->assertJsonPath('data.version', 4);

        $this->assertNull($production->fresh()->courier_id);
        $this->assertSame(4, $production->fresh()->version);

        $log = AppLog::query()->where('message', 'production.updated')->where('request_id', $requestId)->first();
        $this->assertNotNull($log);
        $this->assertSame($actor, $log->actor);
        $this->assertSame(3, $log->context['version']);
    }

    public function test_patch_allows_updating_own_record_case_without_self_duplicate_error(): void
    {
        $production = Production::query()->create([
            'area' => 'Area Tekstil A',
            'production_type' => 'Tenun',
            'status' => 'aktif',
            'version' => 1,
        ]);

        $response = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->patchJson("/api/v1/productions/{$production->id}", [
                'area' => 'area tekstil a',
                'production_type' => 'TENUN',
                'expected_version' => 1,
            ]);

        $response->assertOk()
            ->assertJsonPath('data.area', 'area tekstil a')
            ->assertJsonPath('data.production_type', 'TENUN')
            ->assertJsonPath('data.version', 2);
    }

    public function test_patch_rejects_version_conflict_with_409_and_current_version(): void
    {
        $production = Production::query()->create([
            'area' => 'Area Versi',
            'production_type' => 'Jenis Versi',
            'status' => 'aktif',
            'version' => 5,
        ]);

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->patchJson("/api/v1/productions/{$production->id}", [
                'area' => 'Area Baru',
                'expected_version' => 3,
            ])
            ->assertStatus(409)
            ->assertJson([
                'error' => [
                    'code' => 'VERSION_CONFLICT',
                    'details' => [
                        'current_version' => 5,
                    ],
                ],
            ]);
    }

    public function test_patch_rejects_case_insensitive_duplicate_with_another_active_record_as_409_duplicate(): void
    {
        Production::query()->create([
            'area' => 'Area Tekstil A',
            'production_type' => 'Tenun',
            'status' => 'aktif',
            'version' => 1,
        ]);
        $second = Production::query()->create([
            'area' => 'Area Logam B',
            'production_type' => 'Pengecoran',
            'status' => 'aktif',
            'version' => 1,
        ]);

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->patchJson("/api/v1/productions/{$second->id}", [
                'area' => 'area tekstil a',
                'production_type' => 'TENUN',
                'expected_version' => 1,
            ])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'DUPLICATE');

        // Still unchanged
        $this->assertSame('Area Logam B', $second->fresh()->area);
        $this->assertSame(1, $second->fresh()->version);
    }

    public function test_patch_allows_colliding_with_nonaktif_record(): void
    {
        Production::query()->create([
            'area' => 'Area Tekstil A',
            'production_type' => 'Tenun',
            'status' => 'nonaktif',
            'version' => 2,
        ]);
        $active = Production::query()->create([
            'area' => 'Area Logam B',
            'production_type' => 'Pengecoran',
            'status' => 'aktif',
            'version' => 1,
        ]);

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->patchJson("/api/v1/productions/{$active->id}", [
                'area' => 'area tekstil a',
                'production_type' => 'TENUN',
                'expected_version' => 1,
            ])
            ->assertOk()
            ->assertJsonPath('data.area', 'area tekstil a')
            ->assertJsonPath('data.version', 2);
    }

    public function test_patch_handles_postgresql_23505_unique_violation_race_condition_as_409_duplicate(): void
    {
        $production = Production::query()->create([
            'area' => 'Area Patch Race',
            'production_type' => 'Awal',
            'status' => 'aktif',
            'version' => 1,
        ]);

        $triggered = false;

        DB::connection()->beforeExecuting(function (string $query) use (&$triggered): void {
            if (! $triggered && str_starts_with(strtolower(ltrim($query)), 'update "productions"')) {
                $triggered = true;
                $pdoException = new PDOException(
                    'SQLSTATE[23505]: Unique violation: 7 ERROR: duplicate key value violates unique constraint "productions_active_unique"',
                    23505
                );
                $pdoException->errorInfo = [
                    '23505',
                    7,
                    'ERROR: duplicate key value violates unique constraint "productions_active_unique"',
                ];

                throw new QueryException('pgsql', $query, [], $pdoException);
            }
        });

        $response = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->patchJson("/api/v1/productions/{$production->id}", [
                'production_type' => 'Berubah',
                'expected_version' => 1,
            ]);

        $this->assertTrue($triggered);
        $response->assertStatus(409)
            ->assertJsonPath('error.code', 'DUPLICATE');
    }

    public function test_patch_returns_404_not_found_and_422_validation_error(): void
    {
        $missingUuid = (string) Str::uuid();
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->patchJson("/api/v1/productions/{$missingUuid}", [
                'area' => 'Area Baru',
                'expected_version' => 1,
            ])
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->patchJson('/api/v1/productions/invalid-uuid', [
                'area' => 'Area Baru',
                'expected_version' => 1,
            ])
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');

        $production = Production::query()->create([
            'area' => 'Area Validasi',
            'production_type' => 'Tenun',
            'status' => 'aktif',
            'version' => 1,
        ]);

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->patchJson("/api/v1/productions/{$production->id}", [
                'area' => 'X',
                'courier_id' => 'not-a-uuid',
            ])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['error' => ['details' => ['fields' => ['expected_version', 'area', 'courier_id']]]]);
    }

    public function test_soft_deactivates_production_via_delete_with_expected_version_query_and_logs(): void
    {
        $production = Production::query()->create([
            'area' => 'Area Deactivate',
            'production_type' => 'Tenun',
            'status' => 'aktif',
            'version' => 1,
        ]);
        $actor = 'admin-deleter';
        $requestId = 'req-trace-del-prod-1';

        $response = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->withHeader('X-Acting-User', $actor)
            ->withHeader('X-Request-Id', $requestId)
            ->deleteJson("/api/v1/productions/{$production->id}?expected_version=1");

        $response->assertOk()
            ->assertJson([
                'data' => [
                    'id' => $production->id,
                    'status' => 'nonaktif',
                    'version' => 2,
                ],
            ])
            ->assertHeader('X-Request-Id', $requestId);

        $fresh = $production->fresh();
        $this->assertSame('nonaktif', $fresh->status);
        $this->assertSame(2, $fresh->version);

        $log = AppLog::query()->where('message', 'production.deactivated')->latest('id')->first();
        $this->assertNotNull($log);
        $this->assertSame($actor, $log->actor);
        $this->assertSame($requestId, $log->request_id);
        $this->assertSame(2, $log->context['version']);
    }

    public function test_delete_validates_expected_version_query_and_handles_conflict_and_not_found(): void
    {
        $production = Production::query()->create([
            'area' => 'Area Delete Test',
            'production_type' => 'Tenun',
            'status' => 'aktif',
            'version' => 3,
        ]);

        // Missing query param -> 422
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->deleteJson("/api/v1/productions/{$production->id}")
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['error' => ['details' => ['fields' => ['expected_version']]]]);

        // Non-integer query param -> 422
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->deleteJson("/api/v1/productions/{$production->id}?expected_version=1.5")
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');

        // Mismatched version -> 409 VERSION_CONFLICT
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->deleteJson("/api/v1/productions/{$production->id}?expected_version=1")
            ->assertStatus(409)
            ->assertJson([
                'error' => [
                    'code' => 'VERSION_CONFLICT',
                    'details' => [
                        'current_version' => 3,
                    ],
                ],
            ]);

        // Non-existent / invalid UUID -> 404
        $missingUuid = (string) Str::uuid();
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->deleteJson("/api/v1/productions/{$missingUuid}?expected_version=1")
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->deleteJson('/api/v1/productions/not-a-uuid?expected_version=1')
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');
    }
}
