<?php

use App\Models\AuditEvent;
use App\Models\Console;
use App\Models\ConsoleHealthCheck;
use App\Models\LogSyncState;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

function consolePayload(array $overrides = []): array
{
    return array_replace_recursive([
        'slug' => 'hr',
        'name' => 'Web HR',
        'base_url' => 'http://hr.test',
        'auth_type' => 'api_key',
        'credentials' => ['header' => 'X-API-Key', 'key' => 'super-secret-key'],
        'config' => [
            'health' => ['path' => '/health', 'requires_auth' => false],
            'resources' => [[
                'key' => 'employees', 'label' => 'Karyawan', 'list_path' => '/employees', 'item_path' => '/employees/{id}',
                'id_field' => 'id', 'data_path' => 'data', 'update_method' => 'PATCH', 'writable_fields' => ['name', 'role'],
            ]],
        ],
    ], $overrides);
}

it('lists consoles in the contract shape', function () {
    Sanctum::actingAs(User::factory()->create());
    Console::factory()->create(consolePayload());

    $this->getJson('/api/v1/consoles')
        ->assertOk()
        ->assertJsonStructure([
            'data' => [['id', 'slug', 'name', 'base_url', 'auth_type', 'status', 'last_latency_ms', 'last_checked_at', 'last_error', 'resources' => [['key', 'label', 'writable_fields']]]],
            'meta' => ['next_cursor', 'total'],
        ])
        ->assertJsonPath('data.0.resources.0.writable_fields', ['name', 'role'])
        ->assertJsonPath('meta.next_cursor', null);
});

it('shows last_error from log sync state', function () {
    Sanctum::actingAs(User::factory()->create());
    $console = Console::factory()->create();
    LogSyncState::query()->create(['console_id' => $console->id, 'last_error' => 'Web X tidak dapat dihubungi.']);

    $this->getJson("/api/v1/consoles/{$console->id}")
        ->assertOk()
        ->assertJsonPath('data.last_error', 'Web X tidak dapat dihubungi.');
});

it('returns 404 envelope for an unknown console', function () {
    Sanctum::actingAs(User::factory()->create());

    assertApiError($this->getJson('/api/v1/consoles/999999'), 404, 'NOT_FOUND');
});

it('lets admins create a console and never echoes credentials', function () {
    Sanctum::actingAs(User::factory()->admin()->create());

    $response = $this->postJson('/api/v1/consoles', consolePayload())->assertCreated()->assertJsonPath('data.slug', 'hr');

    expect($response->getContent())->not->toContain('super-secret-key')->not->toContain('credentials');

    $console = Console::query()->firstWhere('slug', 'hr');
    expect($console->credentials['key'])->toBe('super-secret-key')
        ->and($console->getRawOriginal('credentials'))->not->toContain('super-secret-key');

    $audit = AuditEvent::query()->firstWhere('action', 'console.created');
    expect(json_encode($audit->details))->not->toContain('super-secret-key');
});

it('forbids non admins from creating consoles', function () {
    Sanctum::actingAs(User::factory()->create());

    assertApiError($this->postJson('/api/v1/consoles', consolePayload()), 403, 'FORBIDDEN');
});

it('rejects base urls blocked by the host guard', function () {
    config(['consolehub.allow_private_hosts' => false]);
    Sanctum::actingAs(User::factory()->admin()->create());

    $response = $this->postJson('/api/v1/consoles', consolePayload(['base_url' => 'http://169.254.169.254']));

    assertApiError($response, 422, 'VALIDATION_FAILED');
    $response->assertJsonStructure(['error' => ['fields' => ['base_url']]]);
});

it('validates config shape', function () {
    Sanctum::actingAs(User::factory()->admin()->create());

    $payload = consolePayload(['auth_type' => 'magic']);
    $payload['config']['resources'] = [['key' => 'x']];

    $response = $this->postJson('/api/v1/consoles', $payload);

    assertApiError($response, 422, 'VALIDATION_FAILED');
    $response->assertJsonStructure(['error' => ['fields' => ['auth_type', 'config.resources.0.list_path']]]);
});

it('updates a console and audits changed fields without secrets', function () {
    Sanctum::actingAs(User::factory()->admin()->create());
    $console = Console::factory()->create();

    $this->patchJson("/api/v1/consoles/{$console->id}", ['name' => 'Web Baru', 'credentials' => ['header' => 'X-Key', 'key' => 'rotated-secret']])
        ->assertOk()
        ->assertJsonPath('data.name', 'Web Baru');

    $audit = AuditEvent::query()->firstWhere('action', 'console.updated');
    expect($audit->details['credentials_changed'])->toBeTrue()
        ->and(json_encode($audit->details))->not->toContain('rotated-secret');
});

it('deletes a console', function () {
    Sanctum::actingAs(User::factory()->admin()->create());
    $console = Console::factory()->create();

    $this->deleteJson("/api/v1/consoles/{$console->id}")->assertNoContent();

    expect(Console::query()->find($console->id))->toBeNull()
        ->and(AuditEvent::query()->where('action', 'console.deleted')->exists())->toBeTrue();
});

it('tests a healthy console and stores the result', function () {
    Sanctum::actingAs(User::factory()->create());
    $console = Console::factory()->create(['base_url' => 'http://hr.test']);
    Http::fake(['hr.test/health' => Http::response(['ok' => true])]);

    $this->postJson("/api/v1/consoles/{$console->id}/test")
        ->assertOk()
        ->assertJsonPath('data.status', 'ok')
        ->assertJsonStructure(['data' => ['status', 'latency_ms', 'message']]);

    expect($console->refresh()->status)->toBe('ok')
        ->and($console->last_checked_at)->not->toBeNull()
        ->and(ConsoleHealthCheck::query()->where('console_id', $console->id)->count())->toBe(1);
});

it('marks a console down when the health check fails and exposes the message as last_error', function () {
    Sanctum::actingAs(User::factory()->create());
    $console = Console::factory()->create(['name' => 'Web HR', 'base_url' => 'http://hr.test']);
    Http::fake(['hr.test/*' => Http::response('down', 503)]);

    $this->postJson("/api/v1/consoles/{$console->id}/test")->assertOk()->assertJsonPath('data.status', 'down');

    $this->getJson("/api/v1/consoles/{$console->id}")
        ->assertJsonPath('data.status', 'down')
        ->assertJsonPath('data.last_error', 'Web HR sedang tidak tersedia (HTTP 503).');
});

it('marks a console slow above 2000 ms', function () {
    config(['consolehub.slow_threshold_ms' => -1]);
    Sanctum::actingAs(User::factory()->create());
    $console = Console::factory()->create(['base_url' => 'http://hr.test']);
    Http::fake(['hr.test/*' => Http::response([])]);

    $this->postJson("/api/v1/consoles/{$console->id}/test")->assertJsonPath('data.status', 'slow');
});

it('probes with auth when the health endpoint requires it', function () {
    Sanctum::actingAs(User::factory()->create());
    $console = Console::factory()->create([
        'base_url' => 'http://hr.test',
        'credentials' => ['header' => 'X-API-Key', 'key' => 'k'],
        'config' => ['health' => ['path' => '/health', 'requires_auth' => true]],
    ]);
    Http::fake(['hr.test/*' => Http::response([])]);

    $this->postJson("/api/v1/consoles/{$console->id}/test")->assertOk();

    Http::assertSent(fn ($r) => $r->header('X-API-Key') === ['k']);
});
