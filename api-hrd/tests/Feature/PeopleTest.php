<?php

use App\Models\AppLog;
use App\Models\Person;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->serviceKey = config('hr.service_key');
});

it('lists active people by default with envelope and pagination', function () {
    $p1 = Person::query()->create(['name' => 'Budi Santoso', 'role' => 'Staf Gudang', 'status' => 'aktif', 'version' => 1]);
    $p2 = Person::query()->create(['name' => 'Siti Rahmawati', 'role' => 'Staf HR', 'status' => 'aktif', 'version' => 1]);
    $p3 = Person::query()->create(['name' => 'Nonaktif User', 'role' => 'Mantan', 'status' => 'nonaktif', 'version' => 1]);

    $response = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->getJson('/api/v1/people');

    $response->assertOk()
        ->assertJsonStructure([
            'data' => [
                '*' => ['id', 'name', 'role', 'status', 'version', 'created_at', 'updated_at'],
            ],
            'meta' => ['next_cursor'],
        ])
        ->assertJsonCount(2, 'data');

    $names = collect($response->json('data'))->pluck('name')->all();
    expect($names)->toContain('Budi Santoso', 'Siti Rahmawati')
        ->and($names)->not->toContain('Nonaktif User');
});

it('can filter people by status=all or status=nonaktif', function () {
    Person::query()->create(['name' => 'Aktif Person', 'role' => 'Role A', 'status' => 'aktif', 'version' => 1]);
    Person::query()->create(['name' => 'Nonaktif Person', 'role' => 'Role B', 'status' => 'nonaktif', 'version' => 1]);

    $allResponse = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->getJson('/api/v1/people?status=all');
    $allResponse->assertOk()->assertJsonCount(2, 'data');

    $nonaktifResponse = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->getJson('/api/v1/people?status=nonaktif');
    $nonaktifResponse->assertOk()->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Nonaktif Person');

    $invalidStatus = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->getJson('/api/v1/people?status=invalid');
    $invalidStatus->assertStatus(422)
        ->assertJsonPath('error.code', 'VALIDATION_ERROR')
        ->assertJsonStructure(['error' => ['details' => ['fields' => ['status']]]]);
});

it('filters people by role and search query q', function () {
    Person::query()->create(['name' => 'Budi Operator', 'role' => 'Operator Produksi', 'status' => 'aktif', 'version' => 1]);
    Person::query()->create(['name' => 'Siti Kurir', 'role' => 'Kurir', 'status' => 'aktif', 'version' => 1]);
    Person::query()->create(['name' => 'Agus Kurir', 'role' => 'Kurir', 'status' => 'aktif', 'version' => 1]);

    $roleResponse = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->getJson('/api/v1/people?role=Kurir');
    $roleResponse->assertOk()->assertJsonCount(2, 'data');

    // Case-insensitive name search
    $qResponse = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->getJson('/api/v1/people?q=budi');
    $qResponse->assertOk()->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Budi Operator');

    // Case-insensitive role search via q
    $qRoleResponse = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->getJson('/api/v1/people?q=operator');
    $qRoleResponse->assertOk()->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Budi Operator');
});

it('fetches multiple people by ?ids= including nonaktif records without pagination', function () {
    $p1 = Person::query()->create(['name' => 'User 1', 'role' => 'Role 1', 'status' => 'aktif', 'version' => 1]);
    $p2 = Person::query()->create(['name' => 'User 2', 'role' => 'Role 2', 'status' => 'nonaktif', 'version' => 1]);
    $p3 = Person::query()->create(['name' => 'User 3', 'role' => 'Role 3', 'status' => 'aktif', 'version' => 1]);

    $response = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->getJson("/api/v1/people?ids={$p1->id},{$p2->id}");

    $response->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('meta.next_cursor', null);

    $ids = collect($response->json('data'))->pluck('id')->all();
    expect($ids)->toContain($p1->id, $p2->id)
        ->and($ids)->not->toContain($p3->id);

    // Empty ids returns empty list
    $this->withHeader('X-Service-Key', $this->serviceKey)
        ->getJson('/api/v1/people?ids=')
        ->assertOk()
        ->assertJsonCount(0, 'data')
        ->assertJsonPath('meta.next_cursor', null);

    // Non-UUID ids are safely ignored
    $this->withHeader('X-Service-Key', $this->serviceKey)
        ->getJson('/api/v1/people?ids=not-a-uuid,another-bad-id')
        ->assertOk()
        ->assertJsonCount(0, 'data')
        ->assertJsonPath('meta.next_cursor', null);
});

it('rejects ?ids= with more than 100 ids with 422 VALIDATION_ERROR', function () {
    $manyIds = implode(',', array_map(fn () => (string) Str::uuid(), range(1, 101)));

    $response = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->getJson("/api/v1/people?ids={$manyIds}");

    $response->assertStatus(422)
        ->assertJsonPath('error.code', 'VALIDATION_ERROR')
        ->assertJsonStructure(['error' => ['details' => ['fields' => ['ids']]]]);
});

it('supports keyset cursor pagination on people list', function () {
    // Create 3 people with deterministic created_at
    $p1 = Person::query()->create(['name' => 'Person 1', 'role' => 'R1', 'status' => 'aktif', 'version' => 1, 'created_at' => now()->subMinutes(3)]);
    $p2 = Person::query()->create(['name' => 'Person 2', 'role' => 'R2', 'status' => 'aktif', 'version' => 1, 'created_at' => now()->subMinutes(2)]);
    $p3 = Person::query()->create(['name' => 'Person 3', 'role' => 'R3', 'status' => 'aktif', 'version' => 1, 'created_at' => now()->subMinute()]);

    $firstPage = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->getJson('/api/v1/people?limit=2');

    $firstPage->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('meta.next_cursor', fn ($c) => is_string($c) && $c !== '');

    $nextCursor = $firstPage->json('meta.next_cursor');

    $secondPage = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->getJson('/api/v1/people?limit=2&cursor='.$nextCursor);

    $secondPage->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('meta.next_cursor', null);
});

it('gets single person detail by ID and 404s on non-existent or invalid UUID', function () {
    $person = Person::query()->create(['name' => 'Target Person', 'role' => 'Target Role', 'status' => 'aktif', 'version' => 1]);

    $response = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->getJson("/api/v1/people/{$person->id}");

    $response->assertOk()
        ->assertJson([
            'data' => [
                'id' => $person->id,
                'name' => 'Target Person',
                'role' => 'Target Role',
                'status' => 'aktif',
                'version' => 1,
            ],
        ]);

    // Non-existent UUID
    $missingUuid = (string) Str::uuid();
    $this->withHeader('X-Service-Key', $this->serviceKey)
        ->getJson("/api/v1/people/{$missingUuid}")
        ->assertStatus(404)
        ->assertJsonPath('error.code', 'NOT_FOUND');

    // Invalid UUID format
    $this->withHeader('X-Service-Key', $this->serviceKey)
        ->getJson('/api/v1/people/not-a-uuid')
        ->assertStatus(404)
        ->assertJsonPath('error.code', 'NOT_FOUND');
});

it('creates a person via POST with version=1, status=aktif, and logs the action', function () {
    $actor = 'admin-user-42';
    $requestId = 'req-trace-post-1';

    $payload = [
        'name' => 'Rian Ardiansyah',
        'role' => 'Supervisor Logistik',
    ];

    $response = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->withHeader('X-Acting-User', $actor)
        ->withHeader('X-Request-Id', $requestId)
        ->postJson('/api/v1/people', $payload);

    $response->assertStatus(201)
        ->assertJson([
            'data' => [
                'name' => 'Rian Ardiansyah',
                'role' => 'Supervisor Logistik',
                'status' => 'aktif',
                'version' => 1,
            ],
        ])
        ->assertHeader('X-Request-Id', $requestId);

    $createdId = $response->json('data.id');
    expect(Person::query()->where('id', $createdId)->exists())->toBeTrue();

    // Verify log entry created
    $log = AppLog::query()->where('message', 'person.created')->latest('id')->first();
    expect($log)->not->toBeNull()
        ->and($log->actor)->toBe($actor)
        ->and($log->request_id)->toBe($requestId)
        ->and($log->context['person_id'])->toBe($createdId);
});

it('validates POST payload fields and returns 422 VALIDATION_ERROR', function () {
    $response = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->postJson('/api/v1/people', [
            'name' => 'A', // min 2
        ]);

    $response->assertStatus(422)
        ->assertJsonPath('error.code', 'VALIDATION_ERROR')
        ->assertJsonStructure([
            'error' => [
                'code',
                'message',
                'details' => [
                    'fields' => ['name', 'role'],
                ],
            ],
        ]);
});

it('accepts optional id on POST and rejects duplicate id with 409 DUPLICATE', function () {
    $customId = (string) Str::uuid();

    $response = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->postJson('/api/v1/people', [
            'id' => $customId,
            'name' => 'Custom ID Person',
            'role' => 'Role Custom',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('data.id', $customId);

    // Duplicate POST with same id
    $duplicateResponse = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->postJson('/api/v1/people', [
            'id' => $customId,
            'name' => 'Duplicate Attempt',
            'role' => 'Role Custom',
        ]);

    $duplicateResponse->assertStatus(409)
        ->assertJsonPath('error.code', 'DUPLICATE');
});

it('updates person via PATCH, increments version, and logs update', function () {
    $person = Person::query()->create(['name' => 'Old Name', 'role' => 'Old Role', 'status' => 'aktif', 'version' => 2]);
    $actor = 'editor-99';
    $requestId = 'req-trace-patch-1';

    $response = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->withHeader('X-Acting-User', $actor)
        ->withHeader('X-Request-Id', $requestId)
        ->patchJson("/api/v1/people/{$person->id}", [
            'name' => 'New Name',
            'expected_version' => 2,
        ]);

    $response->assertOk()
        ->assertJson([
            'data' => [
                'id' => $person->id,
                'name' => 'New Name',
                'role' => 'Old Role',
                'version' => 3,
            ],
        ])
        ->assertHeader('X-Request-Id', $requestId);

    expect($person->fresh()->version)->toBe(3);

    $log = AppLog::query()->where('message', 'person.updated')->latest('id')->first();
    expect($log)->not->toBeNull()
        ->and($log->actor)->toBe($actor)
        ->and($log->context['version'])->toBe(3);
});

it('rejects PATCH with 409 VERSION_CONFLICT when expected_version does not match', function () {
    $person = Person::query()->create(['name' => 'Version Check', 'role' => 'Role', 'status' => 'aktif', 'version' => 5]);

    $response = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->patchJson("/api/v1/people/{$person->id}", [
            'name' => 'New Name',
            'expected_version' => 3, // Actual is 5
        ]);

    $response->assertStatus(409)
        ->assertJson([
            'error' => [
                'code' => 'VERSION_CONFLICT',
                'details' => [
                    'current_version' => 5,
                ],
            ],
        ]);
});

it('soft-deactivates person via DELETE with expected_version query string and increments version', function () {
    $person = Person::query()->create(['name' => 'To Deactivate', 'role' => 'Courier', 'status' => 'aktif', 'version' => 1]);
    $actor = 'admin-deleter';
    $requestId = 'req-trace-del-1';

    $response = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->withHeader('X-Acting-User', $actor)
        ->withHeader('X-Request-Id', $requestId)
        ->deleteJson("/api/v1/people/{$person->id}?expected_version=1");

    $response->assertOk()
        ->assertJson([
            'data' => [
                'id' => $person->id,
                'status' => 'nonaktif',
                'version' => 2,
            ],
        ])
        ->assertHeader('X-Request-Id', $requestId);

    $fresh = $person->fresh();
    expect($fresh->status)->toBe('nonaktif')
        ->and($fresh->version)->toBe(2);

    $log = AppLog::query()->where('message', 'person.deactivated')->latest('id')->first();
    expect($log)->not->toBeNull()
        ->and($log->actor)->toBe($actor)
        ->and($log->context['version'])->toBe(2);
});

it('rejects DELETE without expected_version in query string with 422 VALIDATION_ERROR', function () {
    $person = Person::query()->create(['name' => 'To Deactivate', 'role' => 'Courier', 'status' => 'aktif', 'version' => 1]);

    $response = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->deleteJson("/api/v1/people/{$person->id}");

    $response->assertStatus(422)
        ->assertJsonPath('error.code', 'VALIDATION_ERROR')
        ->assertJsonStructure(['error' => ['details' => ['fields' => ['expected_version']]]]);

    $this->withHeader('X-Service-Key', $this->serviceKey)
        ->deleteJson("/api/v1/people/{$person->id}?expected_version=1.5")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'VALIDATION_ERROR');
});

it('rejects DELETE with 409 VERSION_CONFLICT when query expected_version does not match', function () {
    $person = Person::query()->create(['name' => 'To Deactivate', 'role' => 'Courier', 'status' => 'aktif', 'version' => 3]);

    $response = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->deleteJson("/api/v1/people/{$person->id}?expected_version=1");

    $response->assertStatus(409)
        ->assertJson([
            'error' => [
                'code' => 'VERSION_CONFLICT',
                'details' => [
                    'current_version' => 3,
                ],
            ],
        ]);
});
