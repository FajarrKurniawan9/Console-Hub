<?php

use App\Mail\OtpCodeMail;
use App\Models\AuditEvent;
use App\Models\OtpCode;
use App\Models\Permission;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;

beforeEach(function () {
    config([
        'services.recaptcha.enabled' => true,
        'services.recaptcha.secret_key' => 'test-recaptcha-secret',
    ]);
});

it('sends an OTP email after verifying reCAPTCHA and stores a hashed code', function () {
    Mail::fake();
    Http::fake([
        'https://www.google.com/recaptcha/api/siteverify' => Http::response(['success' => true]),
    ]);

    $user = User::factory()->create(['email' => 'otp-user@example.com', 'name' => 'Budi Santoso']);

    $response = $this->postJson('/api/v1/auth/request-otp', [
        'email' => 'OTP-USER@EXAMPLE.COM',
        'recaptcha_token' => 'valid-captcha-token',
    ]);

    $response->assertOk()
        ->assertJsonPath('message', 'Kode OTP telah dikirim ke email Anda.')
        ->assertJsonPath('expires_in', 300)
        ->assertJsonPath('data.message', 'Kode OTP telah dikirim ke email Anda.')
        ->assertJsonPath('data.expires_in', 300);

    $sentOtp = null;

    Mail::assertSent(OtpCodeMail::class, function (OtpCodeMail $mail) use ($user, &$sentOtp): bool {
        $sentOtp = $mail->otp;

        return $mail->hasTo($user->email)
            && $mail->userName === $user->name
            && preg_match('/^\d{6}$/', $mail->otp) === 1;
    });

    expect($sentOtp)->not->toBeNull();

    $record = OtpCode::query()->where('email', 'otp-user@example.com')->first();

    expect($record)->not->toBeNull()
        ->and($record->code_hash)->not->toBe($sentOtp)
        ->and(Hash::check((string) $sentOtp, $record->code_hash))->toBeTrue()
        ->and($record->attempts)->toBe(0)
        ->and($record->used_at)->toBeNull()
        ->and($record->expires_at->diffInSeconds(now(), true))->toBeGreaterThan(290)->toBeLessThanOrEqual(300);

    Http::assertSent(function ($request) {
        return $request->url() === 'https://www.google.com/recaptcha/api/siteverify'
            && $request['secret'] === 'test-recaptcha-secret'
            && $request['response'] === 'valid-captcha-token';
    });
});

it('renders the OTP mailable HTML with the 6-digit code and 5-minute expiry notice', function () {
    $mailable = new OtpCodeMail('042819', 'Siti Aminah');

    $mailable->assertSeeInHtml('042819')
        ->assertSeeInHtml('Siti Aminah')
        ->assertSeeInHtml('5 menit');
});

it('bypasses reCAPTCHA verification when disabled in config', function () {
    config(['services.recaptcha.enabled' => false]);
    Mail::fake();

    $user = User::factory()->create(['email' => 'local@example.com']);

    $this->postJson('/api/v1/auth/request-otp', [
        'email' => $user->email,
    ])->assertOk();

    Mail::assertSent(OtpCodeMail::class, fn (OtpCodeMail $mail) => $mail->hasTo($user->email));
    Http::assertNothingSent();
});

it('rejects OTP requests when reCAPTCHA fails or is missing', function () {
    Mail::fake();
    Http::fake([
        'https://www.google.com/recaptcha/api/siteverify' => Http::response(['success' => false]),
    ]);

    $user = User::factory()->create();

    $missing = $this->postJson('/api/v1/auth/request-otp', ['email' => $user->email]);
    assertApiError($missing, 422, 'VALIDATION_ERROR');
    $missing->assertJsonStructure(['error' => ['details' => ['fields' => ['recaptcha_token']]]]);

    $failed = $this->postJson('/api/v1/auth/request-otp', [
        'email' => $user->email,
        'recaptcha_token' => 'bad-token',
    ]);
    assertApiError($failed, 422, 'VALIDATION_ERROR');
    $failed->assertJsonPath('error.message', 'Verifikasi reCAPTCHA gagal. Silakan coba lagi.');

    Mail::assertNothingSent();
});

it('refuses unregistered and inactive users when requesting OTP', function () {
    config(['services.recaptcha.enabled' => false]);
    Mail::fake();

    $inactive = User::factory()->inactive()->create();

    assertApiError($this->postJson('/api/v1/auth/request-otp', ['email' => 'missing@example.com']), 404, 'NOT_FOUND');
    assertApiError($this->postJson('/api/v1/auth/request-otp', ['email' => $inactive->email]), 403, 'FORBIDDEN');

    Mail::assertNothingSent();
});

it('rate limits OTP requests to once per 60 seconds per email and invalidates previous OTPs', function () {
    config(['services.recaptcha.enabled' => false]);
    Mail::fake();

    $user = User::factory()->create(['email' => 'ratelimit@example.com']);
    RateLimiter::clear('otp-request:'.$user->email);

    $this->postJson('/api/v1/auth/request-otp', ['email' => $user->email])->assertOk();
    $firstRecord = OtpCode::query()->where('email', $user->email)->firstOrFail();

    $throttled = $this->postJson('/api/v1/auth/request-otp', ['email' => $user->email]);
    assertApiError($throttled, 429, 'RATE_LIMITED');
    expect($throttled->json('error.details.retry_after'))->toBeGreaterThan(0)->toBeLessThanOrEqual(60);
    expect((int) $throttled->headers->get('Retry-After'))->toBeGreaterThan(0);

    $this->travel(61)->seconds();

    $this->postJson('/api/v1/auth/request-otp', ['email' => $user->email])->assertOk();

    expect($firstRecord->fresh()->used_at)->not->toBeNull()
        ->and(OtpCode::query()->where('email', $user->email)->whereNull('used_at')->count())->toBe(1);
});

it('verifies a valid OTP, issues a standard Sanctum login payload, records audit, and prevents reuse', function () {
    config(['services.recaptcha.enabled' => false]);
    Mail::fake();

    $user = User::factory()->create([
        'email' => 'verify-ok@example.com',
        'password' => null,
    ]);
    RateLimiter::clear('otp-request:'.$user->email);

    $this->postJson('/api/v1/auth/request-otp', ['email' => $user->email])->assertOk();

    $sentOtp = '';
    Mail::assertSent(OtpCodeMail::class, function (OtpCodeMail $mail) use (&$sentOtp): bool {
        $sentOtp = $mail->otp;

        return true;
    });

    $response = $this->postJson('/api/v1/auth/verify-otp', [
        'email' => 'VERIFY-OK@EXAMPLE.COM',
        'otp' => $sentOtp,
    ]);

    $response->assertOk()
        ->assertJsonStructure(['data' => ['token', 'user' => ['id', 'name', 'email', 'role' => ['code', 'name'], 'permissions']]])
        ->assertJsonPath('data.user.id', $user->id)
        ->assertJsonPath('data.user.email', $user->email)
        ->assertJsonPath('data.user.role.code', 'user')
        ->assertJsonPath('data.user.permissions', collect(Permission::USER_DEFAULTS)->sort()->values()->all())
        ->assertJsonMissingPath('data.user.password');

    expect(AuditEvent::query()->where('action', 'auth.login')->where('user_id', $user->id)->exists())->toBeTrue();
    expect(OtpCode::query()->where('email', $user->email)->whereNull('used_at')->count())->toBe(0);

    // Reusing the same OTP fails.
    $reused = $this->postJson('/api/v1/auth/verify-otp', [
        'email' => $user->email,
        'otp' => $sentOtp,
    ]);
    assertApiError($reused, 422, 'VALIDATION_ERROR');
    $reused->assertJsonPath('error.message', 'Kode OTP tidak valid atau sudah kedaluwarsa.');
});

it('increments attempts on wrong OTP and invalidates the OTP after 5 wrong attempts', function () {
    $user = User::factory()->create(['email' => 'attempts@example.com']);

    $record = OtpCode::query()->create([
        'email' => $user->email,
        'code_hash' => Hash::make('123456'),
        'attempts' => 0,
        'expires_at' => now()->addMinutes(5),
    ]);

    foreach (range(1, 4) as $attempt) {
        $response = $this->postJson('/api/v1/auth/verify-otp', [
            'email' => $user->email,
            'otp' => '000000',
        ]);

        assertApiError($response, 422, 'VALIDATION_ERROR');
        expect($record->fresh()->attempts)->toBe($attempt)
            ->and($record->fresh()->used_at)->toBeNull();
    }

    $fifth = $this->postJson('/api/v1/auth/verify-otp', [
        'email' => $user->email,
        'otp' => '000000',
    ]);

    assertApiError($fifth, 429, 'RATE_LIMITED');
    $fifth->assertJsonPath('error.message', 'Terlalu banyak percobaan salah. Silakan minta kode OTP baru.');
    expect($record->fresh()->attempts)->toBe(5)
        ->and($record->fresh()->used_at)->not->toBeNull();

    // Even the correct code no longer works after being invalidated.
    $afterLock = $this->postJson('/api/v1/auth/verify-otp', [
        'email' => $user->email,
        'otp' => '123456',
    ]);
    assertApiError($afterLock, 422, 'VALIDATION_ERROR');
    expect($user->tokens()->count())->toBe(0);
});

it('invalidates an OTP record that already reached 5 attempts and rejects expired OTPs', function () {
    $user = User::factory()->create(['email' => 'expired@example.com']);

    $maxedRecord = OtpCode::query()->create([
        'email' => $user->email,
        'code_hash' => Hash::make('654321'),
        'attempts' => 5,
        'expires_at' => now()->addMinutes(5),
    ]);

    $maxedResponse = $this->postJson('/api/v1/auth/verify-otp', [
        'email' => $user->email,
        'otp' => '654321',
    ]);
    assertApiError($maxedResponse, 429, 'RATE_LIMITED');
    expect($maxedRecord->fresh()->used_at)->not->toBeNull();

    OtpCode::query()->create([
        'email' => $user->email,
        'code_hash' => Hash::make('111222'),
        'attempts' => 0,
        'expires_at' => now()->subSecond(),
    ]);

    $expiredResponse = $this->postJson('/api/v1/auth/verify-otp', [
        'email' => $user->email,
        'otp' => '111222',
    ]);
    assertApiError($expiredResponse, 422, 'VALIDATION_ERROR');
    $expiredResponse->assertJsonPath('error.message', 'Kode OTP tidak valid atau sudah kedaluwarsa.');
});

it('refuses an inactive user during OTP verification', function () {
    $user = User::factory()->inactive()->create(['email' => 'deactivated@example.com']);

    OtpCode::query()->create([
        'email' => $user->email,
        'code_hash' => Hash::make('777888'),
        'attempts' => 0,
        'expires_at' => now()->addMinutes(5),
    ]);

    assertApiError($this->postJson('/api/v1/auth/verify-otp', [
        'email' => $user->email,
        'otp' => '777888',
    ]), 403, 'FORBIDDEN');

    expect($user->tokens()->count())->toBe(0);
});

it('safely refuses password login for a passwordless user without crashing', function () {
    $user = User::factory()->create(['password' => null]);

    assertApiError($this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'anything',
    ]), 401, 'UNAUTHENTICATED');
});
