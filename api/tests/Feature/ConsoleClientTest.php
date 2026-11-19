<?php

use App\Connectors\ConsoleClient;
use App\Connectors\Exceptions\ConsoleException;
use App\Models\Console;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Sleep;

function client(): ConsoleClient
{
    return app(ConsoleClient::class);
}

it('sends the service key, request id and acting user', function () {
    $console = Console::factory()->create(['base_url' => 'http://hr.test', 'service_key' => 'k-123']);
    Http::fake(['hr.test/*' => Http::response(['ok' => true])]);
    Context::add('request_id', 'req-abcdef12');
    $user = actingAsRole();

    $response = client()->request($console, 'GET', '/api/v1/people');

    expect($response->status)->toBe(200)->and($response->body)->toBe(['ok' => true]);
    Http::assertSent(fn (Request $r) => $r->url() === 'http://hr.test/api/v1/people'
        && $r->header('X-Service-Key') === ['k-123']
        && $r->header('X-Request-Id') === ['req-abcdef12']
        && $r->header('X-Acting-User') === [(string) $user->id]);
});

it('supports bearer and basic service keys for later consoles', function () {
    $bearer = Console::factory()->create(['slug' => 'hr', 'base_url' => 'http://hr.test', 'auth_type' => 'bearer', 'service_key' => 'tok-1']);
    $basic = Console::factory()->create(['slug' => 'gudang', 'base_url' => 'http://gudang.test', 'auth_type' => 'basic', 'service_key' => 'hub:rahasia']);
    Http::fake(['*' => Http::response([])]);

    client()->request($bearer, 'GET', '/x');
    client()->request($basic, 'GET', '/x');

    Http::assertSent(fn (Request $r) => $r->header('Authorization') === ['Bearer tok-1']);
    Http::assertSent(fn (Request $r) => $r->header('Authorization') === ['Basic '.base64_encode('hub:rahasia')]);
});

it('maps a timeout to SOURCE_TIMEOUT without retrying', function () {
    $console = Console::factory()->create(['name' => 'Web Produksi', 'slug' => 'produksi', 'base_url' => 'http://produksi.test']);
    Http::fake(['produksi.test/*' => Http::failedConnection('cURL error 28: Operation timed out after 8000 milliseconds')]);

    expect(fn () => client()->request($console, 'GET', '/log'))
        ->toThrow(fn (ConsoleException $e) => expect($e->errorCode)->toBe('SOURCE_TIMEOUT')
            ->and($e->getMessage())->toBe('Web Produksi tidak merespons dalam 8 detik')
            ->and($e->httpStatus())->toBe(504)
            ->and($e->console)->toBe('produksi'));

    Http::assertSentCount(1);
});

it('retries a GET once on a connection error, then maps it to SOURCE_UNREACHABLE', function () {
    $console = Console::factory()->create(['base_url' => 'http://hr.test']);
    Http::fake(['hr.test/*' => Http::failedConnection()]);

    expect(fn () => client()->request($console, 'GET', '/x'))
        ->toThrow(fn (ConsoleException $e) => expect($e->errorCode)->toBe('SOURCE_UNREACHABLE')->and($e->httpStatus())->toBe(502));

    Http::assertSentCount(2);
    Sleep::assertSequence([Sleep::for(1)->second()]);
});

it('recovers when the retried GET succeeds', function () {
    $console = Console::factory()->create(['base_url' => 'http://hr.test']);
    Http::fake(['hr.test/*' => Http::sequence()->pushFailedConnection()->push(['ok' => true])]);

    expect(client()->request($console, 'GET', '/x')->status)->toBe(200);
});

it('does not retry on an HTTP error status', function () {
    $console = Console::factory()->create(['base_url' => 'http://hr.test']);
    Http::fake(['hr.test/*' => Http::response('down', 503)]);

    expect(client()->request($console, 'GET', '/x')->status)->toBe(503);
    Http::assertSentCount(1);
});

it('never retries writes', function () {
    $console = Console::factory()->create(['base_url' => 'http://hr.test']);
    Http::fake(['hr.test/*' => Http::failedConnection()]);

    expect(fn () => client()->request($console, 'POST', '/people', ['name' => 'x']))->toThrow(ConsoleException::class);

    Http::assertSentCount(1);
});

it('maps other non 2xx to SOURCE_UNREACHABLE with the original status and body', function () {
    $console = Console::factory()->create(['base_url' => 'http://hr.test']);
    Http::fake(['hr.test/*' => Http::response(['error' => 'nope'], 500)]);

    expect(fn () => client()->request($console, 'POST', '/x', [], ['throw' => true]))
        ->toThrow(fn (ConsoleException $e) => expect($e->errorCode)->toBe('SOURCE_UNREACHABLE')
            ->and($e->details)->toBe(['status' => 500, 'body' => ['error' => 'nope']]));
});

it('rejects absolute and traversal paths', function (string $path) {
    $console = Console::factory()->create(['base_url' => 'http://hr.test']);

    expect(fn () => client()->request($console, 'GET', $path))->toThrow(InvalidArgumentException::class);
    Http::assertNothingSent();
})->with(['http://evil.test/x', '//evil.test/x', 'relative', '/a/../../etc', 'file:///etc/passwd']);

it('blocks private base urls when private hosts are not allowed', function () {
    config(['consolehub.allow_private_hosts' => false]);
    $console = Console::factory()->create(['base_url' => 'http://127.0.0.1:4001']);

    expect(fn () => client()->request($console, 'GET', '/health'))
        ->toThrow(fn (ConsoleException $e) => expect($e->errorCode)->toBe('SOURCE_UNREACHABLE'));
    Http::assertNothingSent();
});

it('records latency on the response', function () {
    $console = Console::factory()->create(['base_url' => 'http://hr.test']);
    Http::fake(['hr.test/*' => Http::response([])]);

    expect(client()->request($console, 'GET', '/x')->latencyMs)->toBeInt()->toBeGreaterThanOrEqual(0);
});
