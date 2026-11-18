<?php

use App\Models\AuditEvent;
use App\Models\User;

it('logs in with valid credentials and returns a token and user', function () {
    $user = User::factory()->create(['password' => 'rahasia-123']);

    $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'rahasia-123'])
        ->assertOk()
        ->assertJsonStructure(['data' => ['token', 'user' => ['id', 'name', 'email', 'is_admin']]])
        ->assertJsonPath('data.user.id', $user->id)
        ->assertJsonMissingPath('data.user.password');

    expect(AuditEvent::query()->where('action', 'auth.login')->where('user_id', $user->id)->exists())->toBeTrue();
});

it('rejects a wrong password with 401', function () {
    $user = User::factory()->create(['password' => 'rahasia-123']);

    $response = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'salah']);

    assertApiError($response, 401, 'UNAUTHENTICATED');
    $response->assertJsonPath('error.message', 'Email atau sandi salah');
});

it('rejects a malformed login body with 422 and field errors', function () {
    $response = $this->postJson('/api/v1/auth/login', ['email' => 'bukan-email']);

    assertApiError($response, 422, 'VALIDATION_FAILED');
    $response->assertJsonStructure(['error' => ['fields' => ['email', 'password']]]);
});

it('returns the current user from me', function () {
    $user = User::factory()->admin()->create();
    $token = $user->createToken('t')->plainTextToken;

    $this->withToken($token)->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('data.id', $user->id)
        ->assertJsonPath('data.is_admin', true);
});

it('revokes only the current token on logout', function () {
    $user = User::factory()->create();
    $token = $user->createToken('t')->plainTextToken;
    $user->createToken('other');

    $this->withToken($token)->postJson('/api/v1/auth/logout')->assertNoContent();

    expect($user->tokens()->count())->toBe(1);
});

it('rate limits login to 5 attempts per minute per email and ip', function () {
    foreach (range(1, 5) as $_) {
        $this->postJson('/api/v1/auth/login', ['email' => 'x@example.com', 'password' => 'salah'])->assertStatus(401);
    }

    assertApiError($this->postJson('/api/v1/auth/login', ['email' => 'x@example.com', 'password' => 'salah']), 429, 'RATE_LIMITED');
});
