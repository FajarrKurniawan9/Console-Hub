<?php

use App\Models\AppLog;
use Illuminate\Support\Facades\RateLimiter;

it('returns 429 RATE_LIMITED with envelope when rate limit is exceeded', function () {
    config(['hr.rate_limit_per_minute' => 3]);

    $serviceKey = (string) config('hr.service_key');
    $requestId = 'req-trace-rate-limit';

    RateLimiter::clear(md5('api'.$serviceKey));

    for ($i = 0; $i < 3; $i++) {
        $this->withHeader('X-Service-Key', $serviceKey)
            ->withHeader('X-Request-Id', $requestId)
            ->getJson('/api/v1/people')
            ->assertOk();
    }

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

    $log = AppLog::query()->where('level', 'warn')->where('request_id', $requestId)->latest('id')->first();
    expect($log)->not->toBeNull()
        ->and($log->context['code'] ?? null)->toBe('RATE_LIMITED');

});

// The limiter is registered in AppServiceProvider, so it exists even when routes/api.php is not
// executed (production runs with `route:cache`).
it('defines the api limiter without loading the routes file', function () {
    expect(RateLimiter::limiter('api'))->not->toBeNull()
        ->and((string) file_get_contents(base_path('routes/api.php')))->not->toContain('RateLimiter::for');
});
