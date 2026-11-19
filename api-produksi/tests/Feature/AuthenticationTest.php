<?php

namespace Tests\Feature;

use App\Models\AppLog;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    public function test_rejects_requests_without_service_key_with_401_unauthenticated(): void
    {
        $response = $this->getJson('/api/v1/productions');

        $response->assertStatus(401)
            ->assertJson([
                'error' => [
                    'code' => 'UNAUTHENTICATED',
                    'message' => 'Kunci layanan tidak valid atau tidak disertakan.',
                ],
            ])
            ->assertHeader('X-Request-Id');

        $this->assertArrayNotHasKey('x-service-key', array_change_key_case($response->headers->all(), CASE_LOWER));
        $this->assertStringNotContainsString((string) config('produksi.service_key'), (string) json_encode($response->json()));
    }

    public function test_rejects_requests_with_wrong_service_key_with_401_unauthenticated_and_never_leaks_key(): void
    {
        $wrongKey = 'wrong-secret-key-xyz';
        $requestId = 'req-trace-wrong-key';

        $response = $this->withHeader('X-Service-Key', $wrongKey)
            ->withHeader('X-Request-Id', $requestId)
            ->getJson('/api/v1/productions');

        $response->assertStatus(401)
            ->assertJson([
                'error' => [
                    'code' => 'UNAUTHENTICATED',
                ],
            ])
            ->assertHeader('X-Request-Id', $requestId);

        $body = (string) json_encode($response->json());
        $this->assertStringNotContainsString($wrongKey, $body);
        $this->assertStringNotContainsString((string) config('produksi.service_key'), $body);

        $log = AppLog::query()->where('request_id', $requestId)->latest('id')->first();
        $this->assertNotNull($log);
        $this->assertSame('warn', $log->level);
        $this->assertStringNotContainsString($wrongKey, $log->message);
        $this->assertStringNotContainsString($wrongKey, (string) json_encode($log->context));
        $this->assertStringNotContainsString((string) config('produksi.service_key'), (string) json_encode($log->context));
    }

    public function test_always_returns_request_id_even_on_401_error(): void
    {
        $customId = 'req-trace-401-produksi';

        $response = $this->withHeader('X-Request-Id', $customId)
            ->getJson('/api/v1/productions');

        $response->assertStatus(401)
            ->assertHeader('X-Request-Id', $customId);
    }

    public function test_allows_request_when_valid_service_key_is_supplied_without_cors_wildcard(): void
    {
        $key = (string) config('produksi.service_key');

        $response = $this->withHeader('X-Service-Key', $key)
            ->withHeader('Origin', 'https://browser.example.com')
            ->getJson('/api/v1/productions');

        $response->assertOk()
            ->assertHeader('X-Request-Id')
            ->assertHeaderMissing('Access-Control-Allow-Origin');
    }
}
