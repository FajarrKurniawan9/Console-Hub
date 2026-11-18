<?php

use App\Connectors\Auth\BearerAuth;
use App\Connectors\ConsoleClient;
use App\Connectors\Exceptions\ConsoleException;
use App\Models\Console;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Sleep;

function client(): ConsoleClient
{
    return app(ConsoleClient::class);
}

it('sends the api key header', function () {
    $console = Console::factory()->create(['base_url' => 'http://hr.test', 'credentials' => ['header' => 'X-API-Key', 'key' => 'k-123']]);
    Http::fake(['hr.test/*' => Http::response(['ok' => true])]);

    $response = client()->request($console, 'GET', '/employees');

    expect($response->status)->toBe(200)->and($response->body)->toBe(['ok' => true]);
    Http::assertSent(fn (Request $r) => $r->url() === 'http://hr.test/employees' && $r->header('X-API-Key') === ['k-123']);
});

it('uses basic auth', function () {
    $console = Console::factory()->basic()->create(['base_url' => 'http://produksi.test']);
    Http::fake(['produksi.test/*' => Http::response([])]);

    client()->request($console, 'GET', '/log');

    Http::assertSent(fn (Request $r) => $r->header('Authorization') === ['Basic '.base64_encode('hub:basic-secret-pass')]);
});

it('logs in once for bearer consoles and caches the token', function () {
    $console = Console::factory()->bearer()->create(['base_url' => 'http://gudang.test']);
    Http::fake([
        'gudang.test/auth/login' => Http::response(['access_token' => 'tok-1']),
        'gudang.test/items' => Http::response([]),
    ]);

    client()->request($console, 'GET', '/items');
    client()->request($console, 'GET', '/items');

    Http::assertSentCount(3);
    Http::assertSent(fn (Request $r) => $r->url() === 'http://gudang.test/auth/login' && $r['username'] === 'hub' && $r['password'] === 'bearer-secret-pass');
    Http::assertSent(fn (Request $r) => $r->url() === 'http://gudang.test/items' && $r->header('Authorization') === ['Bearer tok-1']);
    expect(Cache::get(BearerAuth::cacheKey($console)))->toBe('tok-1');
});

it('re-logs in exactly once after a 401 with an expired token', function () {
    $console = Console::factory()->bearer()->create(['base_url' => 'http://gudang.test']);
    Cache::put(BearerAuth::cacheKey($console), 'expired', 60);
    Http::fake([
        'gudang.test/auth/login' => Http::response(['access_token' => 'fresh']),
        'gudang.test/items' => Http::sequence()->push(['message' => 'expired'], 401)->push(['ok' => true], 200),
    ]);

    $response = client()->request($console, 'GET', '/items');

    expect($response->status)->toBe(200);
    Http::assertSentCount(3);
    expect(Cache::get(BearerAuth::cacheKey($console)))->toBe('fresh');
});

it('does not loop when the console keeps answering 401', function () {
    $console = Console::factory()->bearer()->create(['base_url' => 'http://gudang.test']);
    Http::fake([
        'gudang.test/auth/login' => Http::response(['access_token' => 'tok']),
        'gudang.test/items' => Http::response([], 401),
    ]);

    expect(client()->request($console, 'GET', '/items')->status)->toBe(401);
    Http::assertSentCount(4);
});

it('maps a timeout to CONSOLE_TIMEOUT after read retries', function () {
    $console = Console::factory()->create(['name' => 'Web Produksi', 'slug' => 'produksi', 'base_url' => 'http://produksi.test']);
    Http::fake(['produksi.test/*' => Http::failedConnection('cURL error 28: Operation timed out after 8000 milliseconds')]);

    expect(fn () => client()->request($console, 'GET', '/log'))
        ->toThrow(fn (ConsoleException $e) => expect($e->errorCode)->toBe('CONSOLE_TIMEOUT')
            ->and($e->getMessage())->toBe('Web Produksi tidak merespons dalam 8 detik')
            ->and($e->httpStatus())->toBe(504)
            ->and($e->console)->toBe('produksi'));

    Http::assertSentCount(3);
    Sleep::assertSequence([Sleep::for(1)->second(), Sleep::for(2)->seconds()]);
});

it('maps connection failures to CONSOLE_UNREACHABLE', function () {
    $console = Console::factory()->create(['base_url' => 'http://hr.test']);
    Http::fake(['hr.test/*' => Http::failedConnection()]);

    expect(fn () => client()->request($console, 'GET', '/x'))
        ->toThrow(fn (ConsoleException $e) => expect($e->errorCode)->toBe('CONSOLE_UNREACHABLE')->and($e->httpStatus())->toBe(502));
});

it('retries GET on 503 and then maps it to CONSOLE_UNREACHABLE', function () {
    $console = Console::factory()->create(['base_url' => 'http://hr.test']);
    Http::fake(['hr.test/*' => Http::response('down', 503)]);

    expect(fn () => client()->request($console, 'GET', '/x', null, ['throw' => true]))
        ->toThrow(fn (ConsoleException $e) => expect($e->errorCode)->toBe('CONSOLE_UNREACHABLE'));

    Http::assertSentCount(3);
});

it('recovers when a retried GET succeeds', function () {
    $console = Console::factory()->create(['base_url' => 'http://hr.test']);
    Http::fake(['hr.test/*' => Http::sequence()->push('busy', 502)->push(['ok' => true])]);

    expect(client()->request($console, 'GET', '/x')->status)->toBe(200);
    Http::assertSentCount(2);
});

it('never retries writes', function () {
    $console = Console::factory()->create(['base_url' => 'http://hr.test']);
    Http::fake(['hr.test/*' => Http::response('busy', 503)]);

    client()->request($console, 'POST', '/employees', ['name' => 'x']);

    Http::assertSentCount(1);
});

it('maps other non 2xx to CONSOLE_ERROR with the original status and body', function () {
    $console = Console::factory()->create(['base_url' => 'http://hr.test']);
    Http::fake(['hr.test/*' => Http::response(['error' => 'nope'], 409)]);

    expect(fn () => client()->request($console, 'POST', '/x', [], ['throw' => true]))
        ->toThrow(fn (ConsoleException $e) => expect($e->errorCode)->toBe('CONSOLE_ERROR')
            ->and($e->details)->toBe(['status' => 409, 'body' => ['error' => 'nope']]));
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
        ->toThrow(fn (ConsoleException $e) => expect($e->errorCode)->toBe('CONSOLE_UNREACHABLE'));
    Http::assertNothingSent();
});

it('records latency on the response', function () {
    $console = Console::factory()->create(['base_url' => 'http://hr.test']);
    Http::fake(['hr.test/*' => Http::response([])]);

    expect(client()->request($console, 'GET', '/x')->latencyMs)->toBeInt()->toBeGreaterThanOrEqual(0);
});
