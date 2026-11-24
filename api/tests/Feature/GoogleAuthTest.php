<?php

use App\Models\AuditEvent;
use App\Models\Permission;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Cache;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\AbstractProvider;
use Laravel\Socialite\Two\User as SocialiteUser;

beforeEach(function () {
    config([
        'services.frontend_url' => 'http://localhost:5173',
        'services.google.client_id' => 'test-google-client-id',
        'services.google.client_secret' => 'test-google-client-secret',
        'services.google.redirect' => 'http://localhost:8000/api/v1/auth/google/callback',
    ]);
});

function mockGoogleCallbackUser(string $id, string $email, string $name = 'Google User'): void
{
    $socialiteUser = new SocialiteUser;
    $socialiteUser->map([
        'id' => $id,
        'name' => $name,
        'email' => $email,
    ]);

    $provider = Mockery::mock(AbstractProvider::class);
    $provider->shouldReceive('stateless')->once()->andReturnSelf();
    $provider->shouldReceive('user')->once()->andReturn($socialiteUser);

    Socialite::shouldReceive('driver')->once()->with('google')->andReturn($provider);
}

it('redirects to Google OAuth statelessly', function () {
    $provider = Mockery::mock(AbstractProvider::class);
    $provider->shouldReceive('stateless')->once()->andReturnSelf();
    $provider->shouldReceive('redirect')->once()->andReturn(new RedirectResponse('https://accounts.google.com/o/oauth2/auth?client_id=test'));

    Socialite::shouldReceive('driver')->once()->with('google')->andReturn($provider);

    $this->get('/api/v1/auth/google/redirect')
        ->assertRedirect('https://accounts.google.com/o/oauth2/auth?client_id=test');
});

it('links google_id, redirects with a one-time code, and exchanges it once for a standard login payload', function () {
    $admin = User::factory()->admin()->create([
        'email' => 'admin.google@example.com',
        'google_id' => null,
        'password' => null,
    ]);

    mockGoogleCallbackUser('google-sub-12345', 'ADMIN.GOOGLE@EXAMPLE.COM', 'Admin Google');

    $callback = $this->get('/api/v1/auth/google/callback');
    $callback->assertRedirect();

    $location = (string) $callback->headers->get('Location');
    expect($location)->toStartWith('http://localhost:5173/auth/google/callback?code=');

    parse_str((string) parse_url($location, PHP_URL_QUERY), $query);
    $code = (string) ($query['code'] ?? '');

    expect(strlen($code))->toBe(64)
        ->and($admin->fresh()->google_id)->toBe('google-sub-12345');

    $exchange = $this->postJson('/api/v1/auth/google/exchange', ['code' => $code]);

    $exchange->assertOk()
        ->assertJsonStructure(['data' => ['token', 'user' => ['id', 'name', 'email', 'role' => ['code', 'name'], 'permissions']]])
        ->assertJsonPath('data.user.id', $admin->id)
        ->assertJsonPath('data.user.email', $admin->email)
        ->assertJsonPath('data.user.role', ['code' => 'admin_it', 'name' => 'Admin IT'])
        ->assertJsonCount(count(Permission::ALL), 'data.user.permissions')
        ->assertJsonMissingPath('data.user.password');

    expect(AuditEvent::query()->where('action', 'auth.login')->where('user_id', $admin->id)->exists())->toBeTrue();

    // Second exchange with the same one-time code must fail.
    $secondExchange = $this->postJson('/api/v1/auth/google/exchange', ['code' => $code]);
    assertApiError($secondExchange, 422, 'VALIDATION_ERROR');
    $secondExchange->assertJsonPath('error.message', 'Sesi login Google tidak valid atau kedaluwarsa.');
});

it('does not overwrite an existing google_id on subsequent Google logins', function () {
    $user = User::factory()->create([
        'email' => 'linked@example.com',
        'google_id' => 'existing-google-id',
    ]);

    mockGoogleCallbackUser('different-google-id', 'linked@example.com');

    $this->get('/api/v1/auth/google/callback')->assertRedirect();

    expect($user->fresh()->google_id)->toBe('existing-google-id');
});

it('rejects unregistered Google accounts without creating a user', function () {
    $initialUserCount = User::query()->count();

    mockGoogleCallbackUser('google-unknown-99', 'outsider@example.com', 'Outsider');

    $this->get('/api/v1/auth/google/callback')
        ->assertRedirect('http://localhost:5173/auth/google/callback?error=account_not_registered');

    expect(User::query()->count())->toBe($initialUserCount);
});

it('rejects inactive users during Google callback', function () {
    User::factory()->inactive()->create(['email' => 'inactive.google@example.com']);

    mockGoogleCallbackUser('google-inactive-77', 'inactive.google@example.com');

    $this->get('/api/v1/auth/google/callback')
        ->assertRedirect('http://localhost:5173/auth/google/callback?error=account_inactive');
});

it('redirects cleanly when Google OAuth callback throws an exception', function () {
    $provider = Mockery::mock(AbstractProvider::class);
    $provider->shouldReceive('stateless')->once()->andReturnSelf();
    $provider->shouldReceive('user')->once()->andThrow(new RuntimeException('OAuth cancelled by user'));

    Socialite::shouldReceive('driver')->once()->with('google')->andReturn($provider);

    $this->get('/api/v1/auth/google/callback')
        ->assertRedirect('http://localhost:5173/auth/google/callback?error=oauth_failed');
});

it('rejects invalid or deactivated-user Google exchange codes', function () {
    $invalid = $this->postJson('/api/v1/auth/google/exchange', ['code' => 'non-existent-code']);
    assertApiError($invalid, 422, 'VALIDATION_ERROR');
    $invalid->assertJsonPath('error.message', 'Sesi login Google tidak valid atau kedaluwarsa.');

    $inactive = User::factory()->inactive()->create();
    Cache::put('google_oauth_code:inactive-code', $inactive->id, now()->addSeconds(60));

    assertApiError($this->postJson('/api/v1/auth/google/exchange', ['code' => 'inactive-code']), 403, 'FORBIDDEN');
    expect($inactive->tokens()->count())->toBe(0);
});
