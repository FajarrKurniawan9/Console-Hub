<?php

namespace Tests\Feature;

use App\Models\AppLog;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class RateLimitTest extends TestCase
{
    public function test_returns_429_rate_limited_with_envelope_when_rate_limit_is_exceeded(): void
    {
        config(['produksi.rate_limit_per_minute' => 3]);

        $serviceKey = (string) config('produksi.service_key');
        $requestId = 'req-trace-rate-limit';

        RateLimiter::clear(md5('api'.$serviceKey));

        for ($i = 0; $i < 3; $i++) {
            $this->withHeader('X-Service-Key', $serviceKey)
                ->withHeader('X-Request-Id', $requestId)
                ->getJson('/api/v1/productions')
                ->assertOk();
        }

        $response = $this->withHeader('X-Service-Key', $serviceKey)
            ->withHeader('X-Request-Id', $requestId)
            ->getJson('/api/v1/productions');

        $response->assertStatus(429)
            ->assertJson([
                'error' => [
                    'code' => 'RATE_LIMITED',
                    'message' => 'Terlalu banyak permintaan. Silakan coba beberapa saat lagi.',
                ],
            ])
            ->assertHeader('X-Request-Id', $requestId);

        $log = AppLog::query()->where('level', 'warn')->where('request_id', $requestId)->latest('id')->first();
        $this->assertNotNull($log);
        $this->assertSame('RATE_LIMITED', $log->context['code'] ?? null);
    }

    /**
     * The limiter is registered in AppServiceProvider, so it exists even when routes/api.php is not
     * executed (production runs with `route:cache`).
     */
    public function test_api_limiter_is_defined_without_loading_the_routes_file(): void
    {
        $this->assertNotNull(RateLimiter::limiter('api'));
        $this->assertStringNotContainsString('RateLimiter::for', (string) file_get_contents(base_path('routes/api.php')));
    }
}
