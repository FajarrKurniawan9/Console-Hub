<?php

use App\Models\AppLog;

it('rejects requests to /api/v1/people without X-Service-Key with 401 UNAUTHENTICATED', function () {
    $response = $this->getJson('/api/v1/people');

    $response->assertStatus(401)
        ->assertJson([
            'error' => [
                'code' => 'UNAUTHENTICATED',
                'message' => 'Kunci layanan tidak valid atau tidak disertakan.',
            ],
        ])
        ->assertHeader('X-Request-Id');

    expect($response->headers->all())->not->toHaveKey('X-Service-Key')
        ->and(json_encode($response->json()))->not->toContain(config('hr.service_key'));
});

it('rejects requests to /api/v1/people with wrong X-Service-Key with 401 UNAUTHENTICATED and never leaks key', function () {
    $wrongKey = 'wrong-secret-key-xyz';
    $requestId = 'req-trace-wrong-key-hr';

    $response = $this->withHeader('X-Service-Key', $wrongKey)
        ->withHeader('X-Request-Id', $requestId)
        ->getJson('/api/v1/people');

    $response->assertStatus(401)
        ->assertJson([
            'error' => [
                'code' => 'UNAUTHENTICATED',
            ],
        ])
        ->assertHeader('X-Request-Id', $requestId);

    $body = (string) json_encode($response->json());
    expect($body)->not->toContain($wrongKey)
        ->and($body)->not->toContain((string) config('hr.service_key'));

    $log = AppLog::query()->where('request_id', $requestId)->latest('id')->first();
    expect($log)->not->toBeNull()
        ->and($log->level)->toBe('warn')
        ->and($log->message)->not->toContain($wrongKey)
        ->and((string) json_encode($log->context))->not->toContain($wrongKey)
        ->and((string) json_encode($log->context))->not->toContain((string) config('hr.service_key'));
});

it('always returns X-Request-Id even on 401 error', function () {
    $customId = 'req-trace-401-abc';

    $response = $this->withHeader('X-Request-Id', $customId)
        ->getJson('/api/v1/people');

    $response->assertStatus(401)
        ->assertHeader('X-Request-Id', $customId);
});

it('allows request when valid X-Service-Key is supplied without CORS wildcard', function () {
    $key = (string) config('hr.service_key');

    $response = $this->withHeader('X-Service-Key', $key)
        ->withHeader('Origin', 'https://browser.example.com')
        ->getJson('/api/v1/people');

    $response->assertOk()
        ->assertHeader('X-Request-Id')
        ->assertHeaderMissing('Access-Control-Allow-Origin');
});
