<?php

namespace Tests\Feature;

use App\Models\AppLog;
use App\Models\Item;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PDOException;
use Tests\TestCase;

class ItemsTest extends TestCase
{
    private string $serviceKey;

    protected function setUp(): void
    {
        parent::setUp();

        $this->serviceKey = (string) config('gudang.service_key');
    }

    public function test_lists_active_items_by_default_with_envelope_and_structure(): void
    {
        $productionId = (string) Str::uuid();
        $responsibleId = (string) Str::uuid();

        Item::query()->create([
            'name' => 'Kain Katun',
            'kind' => 'kain',
            'production_id' => $productionId,
            'responsible_id' => $responsibleId,
            'quantity' => 120,
            'unit' => 'roll',
            'status' => 'aktif',
            'version' => 1,
        ]);
        Item::query()->create([
            'name' => 'Palet Kayu',
            'kind' => 'logistik',
            'production_id' => null,
            'responsible_id' => null,
            'quantity' => 45,
            'unit' => 'unit',
            'status' => 'aktif',
            'version' => 1,
        ]);
        Item::query()->create([
            'name' => 'Besi Siku Lama',
            'kind' => 'besi',
            'production_id' => null,
            'responsible_id' => null,
            'quantity' => 0,
            'unit' => 'batang',
            'status' => 'nonaktif',
            'version' => 1,
        ]);

        $response = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/items');

        $response->assertOk()
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'id',
                        'name',
                        'kind',
                        'production_id',
                        'responsible_id',
                        'quantity',
                        'unit',
                        'status',
                        'version',
                        'created_at',
                        'updated_at',
                    ],
                ],
                'meta' => ['next_cursor'],
            ])
            ->assertJsonCount(2, 'data');

        $names = collect($response->json('data'))->pluck('name')->all();
        $this->assertContains('Kain Katun', $names);
        $this->assertContains('Palet Kayu', $names);
        $this->assertNotContains('Besi Siku Lama', $names);
    }

    public function test_can_filter_items_by_status_all_or_nonaktif_and_rejects_invalid_status(): void
    {
        Item::query()->create(['name' => 'Barang Aktif', 'kind' => 'kain', 'status' => 'aktif', 'version' => 1]);
        Item::query()->create(['name' => 'Barang Nonaktif', 'kind' => 'besi', 'status' => 'nonaktif', 'version' => 1]);

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/items?status=all')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/items?status=nonaktif')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Barang Nonaktif');

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/items?status=invalid')
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['error' => ['details' => ['fields' => ['status']]]]);
    }

    public function test_filters_items_by_kind_production_id_responsible_id_and_search_query_q(): void
    {
        $prodA = (string) Str::uuid();
        $prodB = (string) Str::uuid();
        $respA = (string) Str::uuid();
        $respB = (string) Str::uuid();

        Item::query()->create([
            'name' => 'Kain Katun',
            'kind' => 'kain',
            'production_id' => $prodA,
            'responsible_id' => $respA,
            'quantity' => 100,
            'unit' => 'roll',
            'status' => 'aktif',
            'version' => 1,
        ]);
        Item::query()->create([
            'name' => 'Besi Hollow 4x4',
            'kind' => 'besi',
            'production_id' => $prodB,
            'responsible_id' => $respB,
            'quantity' => 200,
            'unit' => 'batang',
            'status' => 'aktif',
            'version' => 1,
        ]);
        Item::query()->create([
            'name' => 'Sarden Kaleng 425g',
            'kind' => 'makanan kaleng',
            'production_id' => $prodA,
            'responsible_id' => $respB,
            'quantity' => 50,
            'unit' => 'kaleng',
            'status' => 'aktif',
            'version' => 1,
        ]);

        // Filter by kind
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/items?kind=besi')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Besi Hollow 4x4');

        // Filter by production_id
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson("/api/v1/items?production_id={$prodA}")
            ->assertOk()
            ->assertJsonCount(2, 'data');

        // Invalid production_id UUID returns 422
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/items?production_id=not-a-uuid')
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['error' => ['details' => ['fields' => ['production_id']]]]);

        // Filter by responsible_id
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson("/api/v1/items?responsible_id={$respA}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Kain Katun');

        // Invalid responsible_id UUID returns 422
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/items?responsible_id=not-a-uuid')
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['error' => ['details' => ['fields' => ['responsible_id']]]]);

        // Case-insensitive search on name via q
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/items?q=kaTUN')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Kain Katun');

        // Case-insensitive search on kind via q
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/items?q=MAKANAN')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Sarden Kaleng 425g');
    }

    public function test_fetches_multiple_items_by_ids_including_nonaktif_without_pagination(): void
    {
        $i1 = Item::query()->create(['name' => 'Barang 1', 'kind' => 'kain', 'status' => 'aktif', 'version' => 1]);
        $i2 = Item::query()->create(['name' => 'Barang 2', 'kind' => 'besi', 'status' => 'nonaktif', 'version' => 1]);
        $i3 = Item::query()->create(['name' => 'Barang 3', 'kind' => 'buku', 'status' => 'aktif', 'version' => 1]);

        $response = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson("/api/v1/items?ids={$i1->id},{$i2->id}");

        $response->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.next_cursor', null);

        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($i1->id, $ids);
        $this->assertContains($i2->id, $ids);
        $this->assertNotContains($i3->id, $ids);

        // Empty ids returns empty list
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/items?ids=')
            ->assertOk()
            ->assertJsonCount(0, 'data')
            ->assertJsonPath('meta.next_cursor', null);

        // Non-UUID ids are safely ignored
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/items?ids=not-a-uuid,another-bad-id')
            ->assertOk()
            ->assertJsonCount(0, 'data')
            ->assertJsonPath('meta.next_cursor', null);
    }

    public function test_rejects_ids_with_more_than_100_ids_with_422_validation_error(): void
    {
        $manyIds = implode(',', array_map(fn () => (string) Str::uuid(), range(1, 101)));

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson("/api/v1/items?ids={$manyIds}")
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['error' => ['details' => ['fields' => ['ids']]]]);
    }

    public function test_supports_keyset_cursor_pagination_on_items_list(): void
    {
        (new Item)->forceFill([
            'name' => 'Barang 1',
            'kind' => 'kain',
            'quantity' => 10,
            'unit' => 'pcs',
            'status' => 'aktif',
            'version' => 1,
            'created_at' => now()->subMinutes(3),
            'updated_at' => now()->subMinutes(3),
        ])->save();

        (new Item)->forceFill([
            'name' => 'Barang 2',
            'kind' => 'kain',
            'quantity' => 20,
            'unit' => 'pcs',
            'status' => 'aktif',
            'version' => 1,
            'created_at' => now()->subMinutes(2),
            'updated_at' => now()->subMinutes(2),
        ])->save();

        (new Item)->forceFill([
            'name' => 'Barang 3',
            'kind' => 'kain',
            'quantity' => 30,
            'unit' => 'pcs',
            'status' => 'aktif',
            'version' => 1,
            'created_at' => now()->subMinute(),
            'updated_at' => now()->subMinute(),
        ])->save();

        $firstPage = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/items?limit=2');

        $firstPage->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'Barang 3')
            ->assertJsonPath('data.1.name', 'Barang 2');

        $nextCursor = $firstPage->json('meta.next_cursor');
        $this->assertIsString($nextCursor);
        $this->assertNotSame('', $nextCursor);

        $secondPage = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/items?limit=2&cursor='.$nextCursor);

        $secondPage->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Barang 1')
            ->assertJsonPath('meta.next_cursor', null);

        // Invalid cursor returns 422
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/items?cursor=bad-cursor')
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['error' => ['details' => ['fields' => ['cursor']]]]);
    }

    public function test_lists_distinct_item_kinds_in_use(): void
    {
        Item::query()->create(['name' => 'Kain A', 'kind' => 'kain', 'status' => 'aktif', 'version' => 1]);
        Item::query()->create(['name' => 'Kain B', 'kind' => 'kain', 'status' => 'aktif', 'version' => 1]);
        Item::query()->create(['name' => 'Besi A', 'kind' => 'besi', 'status' => 'aktif', 'version' => 1]);
        Item::query()->create(['name' => 'Arsip Lama', 'kind' => 'arsip', 'status' => 'nonaktif', 'version' => 1]);

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/items/kinds')
            ->assertOk()
            ->assertExactJson([
                'data' => ['besi', 'kain'],
            ]);

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/items/kinds?status=all')
            ->assertOk()
            ->assertExactJson([
                'data' => ['arsip', 'besi', 'kain'],
            ]);
    }

    public function test_gets_single_item_detail_by_id_and_404s_on_missing_or_invalid_uuid(): void
    {
        $productionId = (string) Str::uuid();
        $responsibleId = (string) Str::uuid();
        $item = Item::query()->create([
            'name' => 'Kain Katun',
            'kind' => 'kain',
            'production_id' => $productionId,
            'responsible_id' => $responsibleId,
            'quantity' => 75,
            'unit' => 'roll',
            'status' => 'aktif',
            'version' => 1,
        ]);

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson("/api/v1/items/{$item->id}")
            ->assertOk()
            ->assertJson([
                'data' => [
                    'id' => $item->id,
                    'name' => 'Kain Katun',
                    'kind' => 'kain',
                    'production_id' => $productionId,
                    'responsible_id' => $responsibleId,
                    'quantity' => 75,
                    'unit' => 'roll',
                    'status' => 'aktif',
                    'version' => 1,
                ],
            ]);

        $missingUuid = (string) Str::uuid();
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson("/api/v1/items/{$missingUuid}")
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/items/not-a-uuid')
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');
    }

    public function test_creates_item_via_post_with_version_1_status_aktif_and_logs_action(): void
    {
        $actor = 'admin-gudang-1';
        $requestId = 'req-trace-post-item-1';
        $productionId = (string) Str::uuid();
        $responsibleId = (string) Str::uuid();

        $response = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->withHeader('X-Acting-User', $actor)
            ->withHeader('X-Request-Id', $requestId)
            ->postJson('/api/v1/items', [
                'name' => 'Kain Katun Premium',
                'kind' => 'kain',
                'production_id' => $productionId,
                'responsible_id' => $responsibleId,
                'quantity' => 150,
                'unit' => 'roll',
            ]);

        $response->assertStatus(201)
            ->assertJson([
                'data' => [
                    'name' => 'Kain Katun Premium',
                    'kind' => 'kain',
                    'production_id' => $productionId,
                    'responsible_id' => $responsibleId,
                    'quantity' => 150,
                    'unit' => 'roll',
                    'status' => 'aktif',
                    'version' => 1,
                ],
            ])
            ->assertHeader('X-Request-Id', $requestId);

        $createdId = $response->json('data.id');
        $this->assertTrue(Item::query()->where('id', $createdId)->exists());

        $log = AppLog::query()->where('message', 'item.created')->latest('id')->first();
        $this->assertNotNull($log);
        $this->assertSame('info', $log->level);
        $this->assertSame($actor, $log->actor);
        $this->assertSame($requestId, $log->request_id);
        $this->assertSame($createdId, $log->context['item_id']);
        $this->assertSame(150, $log->context['quantity']);
    }

    public function test_creates_item_with_default_quantity_zero_unit_pcs_and_null_references(): void
    {
        $response = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->postJson('/api/v1/items', [
                'name' => 'Kardus Polos',
                'kind' => 'kemasan',
            ]);

        $response->assertStatus(201)
            ->assertJson([
                'data' => [
                    'name' => 'Kardus Polos',
                    'kind' => 'kemasan',
                    'production_id' => null,
                    'responsible_id' => null,
                    'quantity' => 0,
                    'unit' => 'pcs',
                    'status' => 'aktif',
                    'version' => 1,
                ],
            ]);
    }

    public function test_validates_post_payload_including_negative_quantity_and_returns_422(): void
    {
        $response = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->postJson('/api/v1/items', [
                'name' => 'A', // min 2
                'kind' => 'B', // min 2
                'production_id' => 'invalid-uuid',
                'responsible_id' => 'invalid-uuid',
                'quantity' => -5, // must be >= 0
                'unit' => str_repeat('x', 21), // max 20
            ]);

        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonStructure([
                'error' => [
                    'code',
                    'message',
                    'details' => [
                        'fields' => ['name', 'kind', 'production_id', 'responsible_id', 'quantity', 'unit'],
                    ],
                ],
            ]);

        // Float quantity is also rejected
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->postJson('/api/v1/items', [
                'name' => 'Kabel Listrik',
                'kind' => 'elektronik',
                'quantity' => 2.5,
                'unit' => 'm',
            ])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['error' => ['details' => ['fields' => ['quantity']]]]);
    }

    public function test_accepts_optional_id_on_post_and_rejects_duplicate_id_with_409_duplicate(): void
    {
        $customId = (string) Str::uuid();

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->postJson('/api/v1/items', [
                'id' => $customId,
                'name' => 'Barang Custom',
                'kind' => 'kain',
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.id', $customId);

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->postJson('/api/v1/items', [
                'id' => $customId,
                'name' => 'Barang Berbeda',
                'kind' => 'besi',
            ])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'DUPLICATE');
    }

    public function test_post_handles_postgresql_23505_unique_violation_race_condition_as_409_duplicate(): void
    {
        $triggered = false;

        DB::connection()->beforeExecuting(function (string $query) use (&$triggered): void {
            if (! $triggered && str_starts_with(strtolower(ltrim($query)), 'insert into "items"')) {
                $triggered = true;
                $pdoException = new PDOException(
                    'SQLSTATE[23505]: Unique violation: 7 ERROR: duplicate key value violates unique constraint "items_pkey"',
                    23505
                );
                $pdoException->errorInfo = [
                    '23505',
                    7,
                    'ERROR: duplicate key value violates unique constraint "items_pkey"',
                ];

                throw new QueryException('pgsql', $query, [], $pdoException);
            }
        });

        $response = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->postJson('/api/v1/items', [
                'id' => (string) Str::uuid(),
                'name' => 'Barang Race Condition',
                'kind' => 'kain',
            ]);

        $this->assertTrue($triggered);
        $response->assertStatus(409)
            ->assertJsonPath('error.code', 'DUPLICATE');
    }

    public function test_updates_item_via_patch_increments_version_supports_nullable_uuids_and_logs(): void
    {
        $productionId = (string) Str::uuid();
        $responsibleId = (string) Str::uuid();

        $item = Item::query()->create([
            'name' => 'Kain Lama',
            'kind' => 'kain',
            'production_id' => $productionId,
            'responsible_id' => $responsibleId,
            'quantity' => 50,
            'unit' => 'roll',
            'status' => 'aktif',
            'version' => 2,
        ]);

        $actor = 'editor-gudang';
        $requestId = 'req-trace-patch-item-1';

        // Partial update — omitted references remain unchanged, quantity can be set to 0 and unit to 1-char 'm'
        $response = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->withHeader('X-Acting-User', $actor)
            ->withHeader('X-Request-Id', $requestId)
            ->patchJson("/api/v1/items/{$item->id}", [
                'name' => 'Kain Baru',
                'quantity' => 0,
                'unit' => 'm',
                'expected_version' => 2,
            ]);

        $response->assertOk()
            ->assertJson([
                'data' => [
                    'id' => $item->id,
                    'name' => 'Kain Baru',
                    'kind' => 'kain',
                    'production_id' => $productionId,
                    'responsible_id' => $responsibleId,
                    'quantity' => 0,
                    'unit' => 'm',
                    'version' => 3,
                ],
            ])
            ->assertHeader('X-Request-Id', $requestId);

        // Explicitly unset production_id and responsible_id by sending null
        $unlinkResponse = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->patchJson("/api/v1/items/{$item->id}", [
                'production_id' => null,
                'responsible_id' => null,
                'expected_version' => 3,
            ]);

        $unlinkResponse->assertOk()
            ->assertJsonPath('data.production_id', null)
            ->assertJsonPath('data.responsible_id', null)
            ->assertJsonPath('data.version', 4);

        $fresh = $item->fresh();
        $this->assertNull($fresh->production_id);
        $this->assertNull($fresh->responsible_id);
        $this->assertSame(4, $fresh->version);

        $log = AppLog::query()->where('message', 'item.updated')->where('request_id', $requestId)->first();
        $this->assertNotNull($log);
        $this->assertSame($actor, $log->actor);
        $this->assertSame(3, $log->context['version']);
    }

    public function test_patch_rejects_version_conflict_with_409_and_current_version(): void
    {
        $item = Item::query()->create([
            'name' => 'Barang Versi',
            'kind' => 'buku',
            'quantity' => 10,
            'unit' => 'pcs',
            'status' => 'aktif',
            'version' => 5,
        ]);

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->patchJson("/api/v1/items/{$item->id}", [
                'name' => 'Nama Baru',
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

    public function test_patch_handles_atomic_version_conflict_race_condition(): void
    {
        $item = Item::query()->create([
            'name' => 'Barang Atomic',
            'kind' => 'buku',
            'quantity' => 10,
            'unit' => 'pcs',
            'status' => 'aktif',
            'version' => 1,
        ]);

        $bumped = false;

        DB::connection()->beforeExecuting(function (string $query) use (&$bumped, $item): void {
            if (! $bumped && str_starts_with(strtolower(ltrim($query)), 'update "items"')) {
                $bumped = true;
                DB::table('items')->where('id', $item->id)->update(['version' => 2]);
            }
        });

        $response = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->patchJson("/api/v1/items/{$item->id}", [
                'name' => 'Nama Konflik',
                'expected_version' => 1,
            ]);

        $this->assertTrue($bumped);
        $response->assertStatus(409)
            ->assertJson([
                'error' => [
                    'code' => 'VERSION_CONFLICT',
                    'details' => [
                        'current_version' => 2,
                    ],
                ],
            ]);
    }

    public function test_patch_returns_404_not_found_and_422_validation_error(): void
    {
        $missingUuid = (string) Str::uuid();
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->patchJson("/api/v1/items/{$missingUuid}", [
                'name' => 'Barang Baru',
                'expected_version' => 1,
            ])
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->patchJson('/api/v1/items/invalid-uuid', [
                'name' => 'Barang Baru',
                'expected_version' => 1,
            ])
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');

        $item = Item::query()->create([
            'name' => 'Barang Validasi',
            'kind' => 'kain',
            'quantity' => 10,
            'unit' => 'pcs',
            'status' => 'aktif',
            'version' => 1,
        ]);

        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->patchJson("/api/v1/items/{$item->id}", [
                'name' => 'X',
                'production_id' => 'not-a-uuid',
                'responsible_id' => 'not-a-uuid',
                'quantity' => -1,
                'unit' => null,
            ])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonStructure([
                'error' => [
                    'details' => [
                        'fields' => ['expected_version', 'name', 'production_id', 'responsible_id', 'quantity', 'unit'],
                    ],
                ],
            ]);
    }

    public function test_soft_deactivates_item_via_delete_with_expected_version_query_and_logs(): void
    {
        $item = Item::query()->create([
            'name' => 'Barang Deactivate',
            'kind' => 'besi',
            'quantity' => 10,
            'unit' => 'batang',
            'status' => 'aktif',
            'version' => 1,
        ]);
        $actor = 'admin-deleter';
        $requestId = 'req-trace-del-item-1';

        $response = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->withHeader('X-Acting-User', $actor)
            ->withHeader('X-Request-Id', $requestId)
            ->deleteJson("/api/v1/items/{$item->id}?expected_version=1");

        $response->assertOk()
            ->assertJson([
                'data' => [
                    'id' => $item->id,
                    'status' => 'nonaktif',
                    'version' => 2,
                ],
            ])
            ->assertHeader('X-Request-Id', $requestId);

        $fresh = $item->fresh();
        $this->assertSame('nonaktif', $fresh->status);
        $this->assertSame(2, $fresh->version);

        $log = AppLog::query()->where('message', 'item.deactivated')->latest('id')->first();
        $this->assertNotNull($log);
        $this->assertSame($actor, $log->actor);
        $this->assertSame($requestId, $log->request_id);
        $this->assertSame(2, $log->context['version']);
    }

    public function test_delete_validates_expected_version_query_and_handles_conflict_and_not_found(): void
    {
        $item = Item::query()->create([
            'name' => 'Barang Delete Test',
            'kind' => 'buku',
            'quantity' => 10,
            'unit' => 'pcs',
            'status' => 'aktif',
            'version' => 3,
        ]);

        // Missing query param -> 422
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->deleteJson("/api/v1/items/{$item->id}")
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['error' => ['details' => ['fields' => ['expected_version']]]]);

        // Non-integer query param -> 422
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->deleteJson("/api/v1/items/{$item->id}?expected_version=1.5")
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');

        // Zero or negative query param -> 422
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->deleteJson("/api/v1/items/{$item->id}?expected_version=0")
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');

        // Mismatched version -> 409 VERSION_CONFLICT
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->deleteJson("/api/v1/items/{$item->id}?expected_version=1")
            ->assertStatus(409)
            ->assertJson([
                'error' => [
                    'code' => 'VERSION_CONFLICT',
                    'details' => [
                        'current_version' => 3,
                    ],
                ],
            ]);

        // Non-existent UUID -> 404
        $missingUuid = (string) Str::uuid();
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->deleteJson("/api/v1/items/{$missingUuid}?expected_version=1")
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');

        // Invalid UUID -> 404
        $this->withHeader('X-Service-Key', $this->serviceKey)
            ->deleteJson('/api/v1/items/not-a-uuid?expected_version=1')
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');
    }
}
