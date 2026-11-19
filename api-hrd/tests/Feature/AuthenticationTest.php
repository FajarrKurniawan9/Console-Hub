<?php

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

it('rejects requests to /api/v1/people with wrong X-Service-Key with 401 UNAUTHENTICATED', function () {
    $wrongKey = 'wrong-secret-key-xyz';

    $response = $this->withHeader('X-Service-Key', $wrongKey)
        ->getJson('/api/v1/people');

    $response->assertStatus(401)
        ->assertJson([
            'error' => [
                'code' => 'UNAUTHENTICATED',
            ],
        ])
        ->assertHeader('X-Request-Id');

    expect(json_encode($response->json()))->not->toContain($wrongKey)
        ->and(json_encode($response->json()))->not->toContain(config('hr.service_key'));
});

it('always returns X-Request-Id even on 401 error', function () {
    $customId = 'req-trace-401-abc';

    $response = $this->withHeader('X-Request-Id', $customId)
        ->getJson('/api/v1/people');

    $response->assertStatus(401)
        ->assertHeader('X-Request-Id', $customId);
});

it('allows request when valid X-Service-Key is supplied', function () {
    $key = config('hr.service_key');

    $response = $this->withHeader('X-Service-Key', $key)
        ->getJson('/api/v1/people');

    // Should not be 401
    expect($response->status())->not->toBe(401);
});
