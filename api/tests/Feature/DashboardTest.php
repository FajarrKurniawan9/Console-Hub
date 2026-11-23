<?php

use App\Models\AuditEvent;
use App\Models\Permission;
use App\Models\Role;

beforeEach(fn () => fakeSources());

it('requires login for dashboard items', function () {
    assertApiError($this->getJson('/api/v1/dashboard/items'), 401, 'UNAUTHENTICATED');
});

it('forbids dashboard items without dashboard.view permission', function () {
    actingAsRole('user');

    assertApiError($this->getJson('/api/v1/dashboard/items'), 403, 'FORBIDDEN');
});

it('returns activity trend and kind distribution for permitted roles', function () {
    $user = actingAsRole('user');
    $user->role->permissions()->attach(Permission::query()->firstOrCreate(['code' => 'dashboard.view'])->id);

    // Seed fake audit events
    AuditEvent::query()->create([
        'action' => 'item.created',
        'subject_type' => 'item',
        'subject_id' => '00000000-0000-0000-0000-000000000001',
        'created_at' => now(),
    ]);
    AuditEvent::query()->create([
        'action' => 'item.updated',
        'subject_type' => 'item',
        'subject_id' => '00000000-0000-0000-0000-000000000001',
        'created_at' => now(),
    ]);

    FakeSources::add('items', ['name' => 'Kain katun', 'kind' => 'kain', 'quantity' => 50, 'unit' => 'm', 'status' => 'aktif']);
    FakeSources::add('items', ['name' => 'Besi beton', 'kind' => 'besi', 'quantity' => 20, 'unit' => 'batang', 'status' => 'aktif']);

    $response = $this->getJson('/api/v1/dashboard/items?days=7')->assertOk();

    $response->assertJsonStructure([
        'data' => [
            'total_items',
            'total_quantity',
            'transactions_count',
            'activity_trend' => [
                ['date', 'created', 'updated', 'deactivated'],
            ],
            'kind_distribution' => [
                ['kind', 'count', 'total_quantity'],
            ],
        ],
    ]);

    expect($response->json('data.total_items'))->toBe(2);
    expect($response->json('data.total_quantity'))->toBe(70);
    expect($response->json('data.transactions_count'))->toBe(2);
    expect($response->json('data.activity_trend'))->toHaveCount(7);
});

it('supports custom date range via from and to parameters', function () {
    $user = actingAsRole('user');
    $user->role->permissions()->attach(Permission::query()->firstOrCreate(['code' => 'dashboard.view'])->id);

    $from = now()->subDays(4)->toDateString();
    $to = now()->toDateString();

    $response = $this->getJson("/api/v1/dashboard/items?from={$from}&to={$to}")->assertOk();

    // From $from to $to inclusive is 5 days
    expect($response->json('data.activity_trend'))->toHaveCount(5);
});
