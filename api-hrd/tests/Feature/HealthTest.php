<?php

use Illuminate\Support\Facades\DB;

it('returns status ok without requiring X-Service-Key', function () {
    $response = $this->getJson('/health');

    $response->assertOk()
        ->assertJson([
            'status' => 'ok',
        ])
        ->assertHeader('X-Request-Id');
});

it('preserves incoming X-Request-Id header on health check', function () {
    $customId = 'my-custom-request-id-1234';

    $response = $this->withHeader('X-Request-Id', $customId)
        ->getJson('/health');

    $response->assertOk()
        ->assertHeader('X-Request-Id', $customId);
});

it('returns 503 when the database is unreachable', function () {
    DB::partialMock()
        ->shouldReceive('select')
        ->once()
        ->with('SELECT 1')
        ->andThrow(new RuntimeException('Connection refused'));

    $response = $this->getJson('/health');

    $response->assertStatus(503)
        ->assertJson([
            'status' => 'error',
            'message' => 'Database unreachable',
        ])
        ->assertHeader('X-Request-Id');
});
