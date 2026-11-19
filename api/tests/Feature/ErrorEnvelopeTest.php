<?php

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

    assertApiError($response, 500, 'INTERNAL_ERROR');
    expect($response->getContent())->not->toContain('secret stack detail');
});
