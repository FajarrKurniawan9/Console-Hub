<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class HealthTest extends TestCase
{
    public function test_returns_status_ok_without_requiring_service_key(): void
    {
        $response = $this->getJson('/health');

        $response->assertOk()
            ->assertJson([
                'status' => 'ok',
            ])
            ->assertHeader('X-Request-Id');
    }

    public function test_preserves_incoming_request_id_header_on_health_check(): void
    {
        $customId = 'my-custom-request-id-9102';

        $response = $this->withHeader('X-Request-Id', $customId)
            ->getJson('/health');

        $response->assertOk()
            ->assertHeader('X-Request-Id', $customId);
    }

    public function test_returns_503_when_the_database_is_unreachable(): void
    {
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
    }

    public function test_does_not_emit_wildcard_cors_header_for_browser_origins(): void
    {
        $response = $this->withHeader('Origin', 'https://browser.example.com')
            ->getJson('/health');

        $response->assertOk()
            ->assertHeaderMissing('Access-Control-Allow-Origin');
    }
}
