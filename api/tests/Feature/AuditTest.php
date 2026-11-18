<?php

use App\Models\AuditEvent;
use App\Models\Console;
use App\Models\User;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;

it('is only available to admins', function () {
    Sanctum::actingAs(User::factory()->create());

    assertApiError($this->getJson('/api/v1/audit'), 403, 'FORBIDDEN');
});

it('lists audit events newest first in the contract shape and filters them', function () {
    $admin = User::factory()->admin()->create(['name' => 'Admin']);
    Sanctum::actingAs($admin);
    $console = Console::factory()->create(['slug' => 'hr']);

    Carbon::setTestNow('2026-11-18 08:00:00');
    AuditEvent::query()->create(['user_id' => $admin->id, 'action' => 'console.tested', 'console_id' => $console->id, 'details' => ['status' => 'ok']]);
    Carbon::setTestNow('2026-11-18 09:00:00');
    AuditEvent::query()->create(['user_id' => null, 'action' => 'run.succeeded', 'target_type' => 'run', 'target_id' => 'abc']);
    Carbon::setTestNow('2026-11-18 10:00:00');

    $this->getJson('/api/v1/audit')
        ->assertOk()
        ->assertJsonPath('data.0.action', 'run.succeeded')
        ->assertJsonPath('data.0.user', null)
        ->assertJsonPath('data.0.console', null)
        ->assertJsonPath('data.1.user', ['id' => $admin->id, 'name' => 'Admin'])
        ->assertJsonPath('data.1.console', ['slug' => 'hr'])
        ->assertJsonPath('data.1.created_at', '2026-11-18T08:00:00Z')
        ->assertJsonPath('meta.next_cursor', null);

    $this->getJson("/api/v1/audit?console_id={$console->id}")->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/audit?action=run.succeeded')->assertJsonCount(1, 'data');
    $this->getJson("/api/v1/audit?user_id={$admin->id}")->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/audit?from=2026-11-18T08:30:00Z')->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/audit?limit=1')->assertJsonCount(1, 'data')->assertJsonPath('meta.next_cursor', fn ($c) => is_string($c));
});
