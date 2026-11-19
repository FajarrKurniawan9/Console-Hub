<?php

namespace Tests\Feature;

use App\Models\AppLog;
use Illuminate\Support\Facades\Route;
use RuntimeException;
use Tests\TestCase;

class LogsTest extends TestCase
{
    private string $serviceKey;

    protected function setUp(): void
    {
        parent::setUp();

        $this->serviceKey = (string) config('produksi.service_key');
    }

    public function test_lists_logs_ordered_by_occurred_at_desc_with_uniform_format_and_next_cursor(): void
    {
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
    }

    public function test_filters_logs_with_since_parameter(): void
    {
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
    }

    public function test_rejects_invalid_since_with_422_validation_error(): void
    {
        $response = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/logs?since=not-a-date');

        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['error' => ['details' => ['fields' => ['since']]]]);
    }

    public function test_paginates_logs_using_cursor_pagination_and_rejects_invalid_cursor(): void
    {
        AppLog::query()->create(['occurred_at' => now()->subMinutes(5), 'level' => 'info', 'message' => 'log 1']);
        AppLog::query()->create(['occurred_at' => now()->subMinutes(4), 'level' => 'info', 'message' => 'log 2']);
        AppLog::query()->create(['occurred_at' => now()->subMinutes(3), 'level' => 'info', 'message' => 'log 3']);

        $firstPage = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/logs?limit=2');

        $firstPage->assertOk()
            ->assertJsonCount(2, 'data');

        $nextCursor = $firstPage->json('meta.next_cursor');
        $this->assertIsString($nextCursor);
        $this->assertNotSame('', $nextCursor);

        $secondPage = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/logs?limit=2&cursor='.$nextCursor);

        $secondPage->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.next_cursor', null);

        $invalidCursor = $this->withHeader('X-Service-Key', $this->serviceKey)
            ->getJson('/api/v1/logs?cursor=invalid-cursor-value');

        $invalidCursor->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    public function test_logs_server_errors_to_app_logs_without_leaking_secret_key(): void
    {
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

        $this->assertStringNotContainsString($key, (string) json_encode($response->json()));

        $errorLog = AppLog::query()->where('level', 'error')->latest('id')->first();
        $this->assertNotNull($errorLog);
        $this->assertSame($requestId, $errorLog->request_id);
        $this->assertStringNotContainsString($key, $errorLog->message);
        $this->assertStringNotContainsString($key, (string) json_encode($errorLog->context));
    }
}
