<?php

use App\Connectors\Exceptions\ConsoleException;
use Illuminate\Support\Facades\Route;

it('returns 401 envelope without a token', function () {
    assertApiError($this->getJson('/api/v1/auth/me'), 401, 'UNAUTHENTICATED');
});

it('returns 401 envelope with an invalid token', function () {
    assertApiError($this->withToken('1|nope')->getJson('/api/v1/auth/me'), 401, 'UNAUTHENTICATED');
});

it('returns 404 envelope for unknown endpoints', function () {
    actingAsRole();

    assertApiError($this->getJson('/api/v1/tidak-ada'), 404, 'NOT_FOUND');
});

it('hides internals behind a 500 envelope', function () {
    Route::middleware('api')->get('/api/v1/__boom', fn () => throw new RuntimeException('secret stack detail'));

    $response = $this->getJson('/api/v1/__boom');

    assertApiError($response, 500, 'SERVER_ERROR');
    expect($response->getContent())->not->toContain('secret stack detail');
});

it('hides the source name and url from User and shows it to Admin IT', function (string $role, bool $technical) {
    Route::middleware(['api', 'auth:sanctum'])->get('/api/v1/__source', fn () => throw new ConsoleException('SOURCE_TIMEOUT', 'HR tidak merespons dalam 8 detik', 'hr'));
    actingAsRole($role);

    $response = $this->getJson('/api/v1/__source');

    assertApiError($response, 504, 'SOURCE_TIMEOUT');
    expect(str_contains($response->getContent(), 'HR'))->toBe($technical)
        ->and($response->json('error.details.source'))->toBe($technical ? 'hr' : null);
})->with([['user', false], ['admin_it', true]]);

it('allows the deployed frontend origin in CORS and nothing else', function () {
    $preflight = fn (string $origin) => $this->call('OPTIONS', '/api/v1/auth/login', server: [
        'HTTP_ORIGIN' => $origin,
        'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
        'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'authorization,content-type',
    ]);

    expect($preflight('https://console-hub-smoky.vercel.app')->headers->get('Access-Control-Allow-Origin'))->toBe('https://console-hub-smoky.vercel.app')
        ->and($preflight('https://evil.example')->headers->get('Access-Control-Allow-Origin'))->toBeNull();
});
