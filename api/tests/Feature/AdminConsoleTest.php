<?php

use App\Models\AuditEvent;
use App\Models\Console;
use App\Models\ConsoleHealthCheck;
use App\Models\Permission;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

function healthCheck(Console $console, bool $ok, ?int $latency = 100, int $minutesAgo = 0): void
{
    ConsoleHealthCheck::query()->create([
        'console_id' => $console->id, 'ok' => $ok, 'latency_ms' => $ok ? $latency : null,
        'error' => $ok ? null : "{$console->name} tidak dapat dihubungi.", 'checked_at' => now()->subMinutes($minutesAgo),
    ]);
}

beforeEach(fn () => actingAsRole('admin_it'));

it('lists consoles in the ConsoleInfo shape without the service key', function () {
    $console = Console::factory()->create(['slug' => 'hr', 'service_key' => 'kunci-rahasia-hr']);
    healthCheck($console, true, 120);

    $response = $this->getJson('/api/v1/admin/consoles')
        ->assertOk()
        ->assertJsonStructure(['data' => [['id', 'slug', 'name', 'base_url', 'is_active', 'status', 'latency_ms', 'last_checked_at', 'resource']], 'meta' => ['next_cursor', 'total']])
        ->assertJsonPath('data.0.status', 'ok')
        ->assertJsonPath('data.0.latency_ms', 120)
        ->assertJsonPath('data.0.has_service_key', true);

    expect($response->getContent())->not->toContain('kunci-rahasia-hr')->not->toContain('"service_key"');
});

it('derives unknown, slow and down from the recent health checks', function () {
    $console = Console::factory()->create();
    $this->getJson("/api/v1/admin/consoles/{$console->id}")->assertJsonPath('data.status', 'unknown');

    healthCheck($console, true, 1600, 5);
    $this->getJson("/api/v1/admin/consoles/{$console->id}")->assertJsonPath('data.status', 'slow');

    healthCheck($console, false, minutesAgo: 3);
    healthCheck($console, false, minutesAgo: 2);
    $this->getJson("/api/v1/admin/consoles/{$console->id}")->assertJsonPath('data.status', 'slow');

    healthCheck($console, false, minutesAgo: 1);
    $this->getJson("/api/v1/admin/consoles/{$console->id}")
        ->assertJsonPath('data.status', 'down')
        ->assertJsonPath('data.last_error', "{$console->name} tidak dapat dihubungi.");
});

it('tests a console through /health without the key and audits the result', function () {
    $console = Console::factory()->create(['slug' => 'gudang', 'base_url' => 'http://gudang.test']);
    Http::fake(['gudang.test/health' => Http::response(['ok' => true])]);

    $this->postJson("/api/v1/admin/consoles/{$console->id}/test")
        ->assertOk()
        ->assertJsonStructure(['data' => ['status', 'latency_ms', 'message']])
        ->assertJsonPath('data.status', 'ok');

    Http::assertSent(fn (Request $r) => ! $r->hasHeader('X-Service-Key'));
    expect(ConsoleHealthCheck::query()->where('console_id', $console->id)->value('ok'))->toBeTrue()
        ->and(AuditEvent::query()->where('action', 'console.tested')->value('new_value'))->toMatchArray(['console' => 'gudang', 'status' => 'ok']);
});

it('reports a failing console test as down', function () {
    $console = Console::factory()->create(['base_url' => 'http://hr.test']);
    Http::fake(['hr.test/*' => Http::failedConnection()]);

    $this->postJson("/api/v1/admin/consoles/{$console->id}/test")->assertOk()->assertJsonPath('data.status', 'down');
});

it('creates and updates a console, keeps the key encrypted and out of responses and audit', function () {
    $response = $this->postJson('/api/v1/admin/consoles', [
        'slug' => 'hr', 'name' => 'HR', 'base_url' => 'http://hr.test', 'service_key' => 'super-secret-key', 'resource' => 'people',
    ])->assertCreated();

    $console = Console::query()->findOrFail($response->json('data.id'));
    expect($response->getContent())->not->toContain('super-secret-key')
        ->and($console->service_key)->toBe('super-secret-key')
        ->and($console->getRawOriginal('service_key'))->not->toContain('super-secret-key')
        ->and($console->resource)->toBe('people');

    $this->patchJson("/api/v1/admin/consoles/{$console->id}", ['name' => 'HR Baru', 'service_key' => 'kunci-baru-123'])
        ->assertOk()->assertJsonPath('data.name', 'HR Baru');

    $audits = AuditEvent::query()->whereIn('action', ['console.created', 'console.updated'])->get();
    expect($audits)->toHaveCount(2)
        ->and($audits->toJson())->not->toContain('super-secret-key')->not->toContain('kunci-baru-123')
        ->and($audits->last()->old_value['name'])->toBe('HR')
        ->and($audits->last()->new_value)->toMatchArray(['name' => 'HR Baru', 'service_key_changed' => true]);
});

it('rejects base urls blocked by the host guard', function () {
    config(['consolehub.allow_private_hosts' => false]);

    $response = $this->postJson('/api/v1/admin/consoles', ['slug' => 'x', 'name' => 'X', 'base_url' => 'https://169.254.169.254', 'service_key' => 'abcdefgh']);

    assertApiError($response, 422, 'VALIDATION_FAILED');
    $response->assertJsonStructure(['error' => ['fields' => ['base_url']]]);
});

it('requires one console per resource', function () {
    Console::factory()->create(['slug' => 'hr']);

    $missing = $this->postJson('/api/v1/admin/consoles', ['slug' => 'hr2', 'name' => 'HR 2', 'base_url' => 'http://hr2.test', 'service_key' => 'abcdefgh']);
    $taken = $this->postJson('/api/v1/admin/consoles', ['slug' => 'hr2', 'name' => 'HR 2', 'base_url' => 'http://hr2.test', 'service_key' => 'abcdefgh', 'resource' => 'people']);

    assertApiError($missing, 422, 'VALIDATION_FAILED');
    assertApiError($taken, 422, 'VALIDATION_FAILED');
    $taken->assertJsonStructure(['error' => ['fields' => ['resource']]]);
});

it('needs admin.consoles.manage to change consoles', function () {
    $user = actingAsRole('user');
    $user->role->permissions()->attach(Permission::query()->firstOrCreate(['code' => 'admin.consoles.view'])->id);
    $console = Console::factory()->create();

    $this->getJson('/api/v1/admin/consoles')->assertOk();
    assertApiError($this->patchJson("/api/v1/admin/consoles/{$console->id}", ['name' => 'x']), 403, 'FORBIDDEN');
});
