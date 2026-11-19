<?php

use App\Models\AppLog;
use Illuminate\Support\Facades\Route;

beforeEach(function () {
    $this->serviceKey = (string) config('hr.service_key');
});

it('lists logs ordered by occurred_at desc with uniform format and meta.next_cursor', function () {
    AppLog::query()->create([
        'occurred_at' => now()->subMinutes(10),
        'level' => 'info',
        'message' => 'log lama',
        'actor' => 'user-1',
        'request_id' => 'req-1',
    ]);
    AppLog::query()->create([
        'occurred_at' => now()->subMinute(),
        'level' => 'warn',
        'message' => 'log baru',
        'actor' => 'user-2',
        'request_id' => 'req-2',
    ]);

    $response = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->getJson('/api/v1/logs');

    $response->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonStructure([
            'data' => [
                '*' => ['id', 'occurred_at', 'level', 'message', 'actor'],
            ],
            'meta' => ['next_cursor'],
        ])
        ->assertJsonPath('data.0.message', 'log baru')
        ->assertJsonPath('data.0.level', 'warn')
        ->assertJsonPath('data.0.actor', 'user-2')
        ->assertJsonPath('data.1.message', 'log lama');
});

it('filters logs with ?since= parameter', function () {
    AppLog::query()->create([
        'occurred_at' => now()->subHours(2),
        'level' => 'info',
        'message' => 'two hours ago',
    ]);
    AppLog::query()->create([
        'occurred_at' => now()->subMinutes(15),
        'level' => 'info',
        'message' => 'fifteen minutes ago',
    ]);

    $since = now()->subMinutes(30)->toISOString();

    $response = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->getJson("/api/v1/logs?since={$since}");

    $response->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.message', 'fifteen minutes ago');
});

it('rejects invalid ?since= with 422 VALIDATION_ERROR', function () {
    $response = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->getJson('/api/v1/logs?since=not-a-date');

    $response->assertStatus(422)
        ->assertJsonPath('error.code', 'VALIDATION_ERROR')
        ->assertJsonStructure(['error' => ['details' => ['fields' => ['since']]]]);
});

it('paginates logs using cursor pagination and rejects invalid cursor', function () {
    AppLog::query()->create(['occurred_at' => now()->subMinutes(5), 'level' => 'info', 'message' => 'log 1']);
    AppLog::query()->create(['occurred_at' => now()->subMinutes(4), 'level' => 'info', 'message' => 'log 2']);
    AppLog::query()->create(['occurred_at' => now()->subMinutes(3), 'level' => 'info', 'message' => 'log 3']);

    $firstPage = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->getJson('/api/v1/logs?limit=2');

    $firstPage->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('meta.next_cursor', fn ($c) => is_string($c) && $c !== '');

    $nextCursor = $firstPage->json('meta.next_cursor');

    $secondPage = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->getJson('/api/v1/logs?limit=2&cursor='.$nextCursor);

    $secondPage->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('meta.next_cursor', null);

    // Invalid cursor
    $invalidCursor = $this->withHeader('X-Service-Key', $this->serviceKey)
        ->getJson('/api/v1/logs?cursor=invalid-cursor-value');

    $invalidCursor->assertStatus(422)
        ->assertJsonPath('error.code', 'VALIDATION_ERROR');
});

it('logs server errors to app_logs without leaking secret key', function () {
    $key = $this->serviceKey;
    $requestId = 'req-trace-error-500';

    Route::get('/api/v1/test-fail', function () use ($key) {
        throw new RuntimeException('Unexpected test failure with secret: '.$key);
    })->middleware(['service.key']);

    $response = $this->withHeader('X-Service-Key', $key)
        ->withHeader('X-Request-Id', $requestId)
        ->getJson('/api/v1/test-fail');

    $response->assertStatus(500)
        ->assertJsonPath('error.code', 'SERVER_ERROR')
        ->assertHeader('X-Request-Id', $requestId);

    expect((string) json_encode($response->json()))->not->toContain($key);

    $errorLog = AppLog::query()->where('level', 'error')->latest('id')->first();
    expect($errorLog)->not->toBeNull()
        ->and($errorLog->request_id)->toBe($requestId)
        ->and($errorLog->message)->not->toContain($key)
        ->and((string) json_encode($errorLog->context))->not->toContain($key);
});
