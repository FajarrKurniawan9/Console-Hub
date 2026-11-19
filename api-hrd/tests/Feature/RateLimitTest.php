<?php

use Illuminate\Support\Facades\RateLimiter;

it('returns 429 RATE_LIMITED with envelope when rate limit is exceeded', function () {
    config(['hr.rate_limit_per_minute' => 3]);

    $serviceKey = config('hr.service_key');
    $requestId = 'req-trace-rate-limit';

    // Clear rate limiter cache for test
    RateLimiter::clear($serviceKey);

    // Make 3 allowed requests
    for ($i = 0; $i < 3; $i++) {
        $this->withHeader('X-Service-Key', $serviceKey)
            ->withHeader('X-Request-Id', $requestId)
            ->getJson('/api/v1/people')
            ->assertOk();
    }

    // 4th request must be throttled
    $response = $this->withHeader('X-Service-Key', $serviceKey)
        ->withHeader('X-Request-Id', $requestId)
        ->getJson('/api/v1/people');

    $response->assertStatus(429)
        ->assertJson([
            'error' => [
                'code' => 'RATE_LIMITED',
                'message' => 'Terlalu banyak permintaan. Silakan coba beberapa saat lagi.',
            ],
        ])
        ->assertHeader('X-Request-Id', $requestId);
});
