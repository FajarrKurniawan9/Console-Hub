<?php

use App\Models\User;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;

it('returns 401 envelope without a token', function () {
    assertApiError($this->getJson('/api/v1/auth/me'), 401, 'UNAUTHENTICATED');
});

it('returns 401 envelope with an invalid token', function () {
    assertApiError($this->withToken('1|nope')->getJson('/api/v1/auth/me'), 401, 'UNAUTHENTICATED');
});

it('returns 404 envelope for unknown endpoints', function () {
    Sanctum::actingAs(User::factory()->create());

    assertApiError($this->getJson('/api/v1/tidak-ada'), 404, 'NOT_FOUND');
});

it('returns 403 envelope for non admins on admin routes', function () {
    Route::middleware(['api', 'auth:sanctum', 'admin'])->get('/api/v1/__admin-only', fn () => ['ok' => true]);
    Sanctum::actingAs(User::factory()->create());
    assertApiError($this->getJson('/api/v1/__admin-only'), 403, 'FORBIDDEN');

    Sanctum::actingAs(User::factory()->admin()->create());
    $this->getJson('/api/v1/__admin-only')->assertOk();
});

it('hides internals behind a 500 envelope', function () {
    Route::middleware('api')->get('/api/v1/__boom', fn () => throw new RuntimeException('secret stack detail'));

    $response = $this->getJson('/api/v1/__boom');

    assertApiError($response, 500, 'INTERNAL_ERROR');
    expect($response->getContent())->not->toContain('secret stack detail');
});
