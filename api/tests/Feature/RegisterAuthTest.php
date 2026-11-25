<?php

use App\Mail\OtpCodeMail;
use App\Models\AuditEvent;
use App\Models\OtpCode;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Database\Factories\UserFactory;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;

beforeEach(function () {
    config([
        'services.recaptcha.enabled' => true,
        'services.recaptcha.secret_key' => 'test-recaptcha-secret',
    ]);

    UserFactory::role(Role::USER);
});

it('sends a registration OTP email after verifying reCAPTCHA and stores a hashed code', function () {
    Mail::fake();
    Http::fake([
        'https://www.google.com/recaptcha/api/siteverify' => Http::response(['success' => true]),
    ]);

    $response = $this->postJson('/api/v1/auth/register/request-otp', [
        'name' => '  Dewi Lestari  ',
        'email' => 'DEWI.LESTARI@EXAMPLE.COM',
        'recaptcha_token' => 'valid-captcha-token',
    ]);

    $response->assertOk()
        ->assertJsonPath('message', 'Kode verifikasi pendaftaran telah dikirim ke email Anda.')
        ->assertJsonPath('expires_in', 300)
        ->assertJsonStructure(['data' => ['message', 'expires_in', 'resend_token']]);

    $sentOtp = null;

    Mail::assertSent(OtpCodeMail::class, function (OtpCodeMail $mail) use (&$sentOtp): bool {
        $sentOtp = $mail->otp;

        return $mail->hasTo('dewi.lestari@example.com')
            && $mail->userName === 'Dewi Lestari'
            && $mail->purpose === 'register'
            && preg_match('/^\d{6}$/', $mail->otp) === 1;
    });

    expect($sentOtp)->not->toBeNull();

    $record = OtpCode::query()->where('email', 'dewi.lestari@example.com')->first();

    expect($record)->not->toBeNull()
        ->and(Hash::check((string) $sentOtp, $record->code_hash))->toBeTrue()
        ->and($record->used_at)->toBeNull();

    // Account must NOT exist until the OTP code is actually verified.
    expect(User::query()->where('email', 'dewi.lestari@example.com')->exists())->toBeFalse();
});

it('renders registration OTP mailable with signup copy', function () {
    $mailable = new OtpCodeMail('123456', 'Dewi Lestari', 5, 'register');

    $mailable->assertHasSubject('Kode Verifikasi Pendaftaran — Console Hub')
        ->assertSeeInHtml('123456')
        ->assertSeeInHtml('Dewi Lestari')
        ->assertSeeInHtml('menyelesaikan pendaftaran akun Console Hub Anda');
});

it('verifies registration OTP, creates an active user with default user role, logs audit, and issues token', function () {
    Mail::fake();
    Http::fake([
        'https://www.google.com/recaptcha/api/siteverify' => Http::response(['success' => true]),
    ]);

    RateLimiter::clear('otp-request:new.user@example.com');

    $this->postJson('/api/v1/auth/register/request-otp', [
        'name' => 'Andi Wijaya',
        'email' => 'new.user@example.com',
        'recaptcha_token' => 'valid-captcha-token',
    ])->assertOk();

    $sentOtp = '';
    Mail::assertSent(OtpCodeMail::class, function (OtpCodeMail $mail) use (&$sentOtp): bool {
        $sentOtp = $mail->otp;

        return true;
    });

    $verify = $this->postJson('/api/v1/auth/register/verify', [
        'name' => 'Andi Wijaya',
        'email' => 'NEW.USER@EXAMPLE.COM',
        'otp' => $sentOtp,
    ]);

    $verify->assertCreated()
        ->assertJsonStructure(['data' => ['token', 'user' => ['id', 'name', 'email', 'role' => ['code', 'name'], 'permissions']]])
        ->assertJsonPath('data.user.name', 'Andi Wijaya')
        ->assertJsonPath('data.user.email', 'new.user@example.com')
        ->assertJsonPath('data.user.role.code', 'user')
        ->assertJsonPath('data.user.permissions', collect(Permission::USER_DEFAULTS)->sort()->values()->all())
        ->assertJsonMissingPath('data.user.password');

    $user = User::query()->where('email', 'new.user@example.com')->firstOrFail();

    expect($user->is_active)->toBeTrue()
        ->and($user->password)->toBeNull()
        ->and($user->role->code)->toBe(Role::USER);

    expect(AuditEvent::query()->where('action', 'auth.register')->where('user_id', $user->id)->exists())->toBeTrue()
        ->and(AuditEvent::query()->where('action', 'auth.login')->where('user_id', $user->id)->exists())->toBeTrue()
        ->and(OtpCode::query()->where('email', 'new.user@example.com')->whereNull('used_at')->count())->toBe(0);

    // Token works immediately and enforces default user permissions (allowed /auth/me, denied admin).
    $token = (string) $verify->json('data.token');
    $this->withToken($token)->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('data.email', 'new.user@example.com');

    assertApiError($this->withToken($token)->getJson('/api/v1/admin/overview'), 403, 'FORBIDDEN');
});

it('rejects duplicate email on register request and verify', function () {
    config(['services.recaptcha.enabled' => false]);
    Mail::fake();

    $existing = User::factory()->create(['email' => 'sudahada@example.com']);

    $req = $this->postJson('/api/v1/auth/register/request-otp', [
        'name' => 'Pengguna Duplikat',
        'email' => 'SUDAHADA@EXAMPLE.COM',
    ]);
    assertApiError($req, 422, 'VALIDATION_ERROR');
    $req->assertJsonStructure(['error' => ['details' => ['fields' => ['email']]]]);

    $ver = $this->postJson('/api/v1/auth/register/verify', [
        'name' => 'Pengguna Duplikat',
        'email' => $existing->email,
        'otp' => '123456',
    ]);
    assertApiError($ver, 422, 'VALIDATION_ERROR');
    $ver->assertJsonStructure(['error' => ['details' => ['fields' => ['email']]]]);

    Mail::assertNothingSent();
});

it('rejects missing or invalid reCAPTCHA and fake resend_token, while allowing valid resend_token after 60s', function () {
    Mail::fake();
    Http::fake([
        'https://www.google.com/recaptcha/api/siteverify' => Http::sequence()
            ->push(['success' => false])
            ->push(['success' => true]),
    ]);

    RateLimiter::clear('otp-request:resend.reg@example.com');

    $missing = $this->postJson('/api/v1/auth/register/request-otp', [
        'name' => 'Rudi Hartono',
        'email' => 'resend.reg@example.com',
    ]);
    assertApiError($missing, 422, 'VALIDATION_ERROR');
    $missing->assertJsonStructure(['error' => ['details' => ['fields' => ['recaptcha_token']]]]);

    $failedCaptcha = $this->postJson('/api/v1/auth/register/request-otp', [
        'name' => 'Rudi Hartono',
        'email' => 'resend.reg@example.com',
        'recaptcha_token' => 'bad-token',
    ]);
    assertApiError($failedCaptcha, 422, 'VALIDATION_ERROR');

    $fakeResend = $this->postJson('/api/v1/auth/register/request-otp', [
        'name' => 'Rudi Hartono',
        'email' => 'resend.reg@example.com',
        'resend_token' => 'forged-token',
    ]);
    assertApiError($fakeResend, 422, 'VALIDATION_ERROR');

    $first = $this->postJson('/api/v1/auth/register/request-otp', [
        'name' => 'Rudi Hartono',
        'email' => 'resend.reg@example.com',
        'recaptcha_token' => 'good-token',
    ])->assertOk();

    $resendToken = (string) $first->json('data.resend_token');
    expect($resendToken)->not->toBe('');

    // Within 60s must be rate-limited even with a valid resend_token.
    assertApiError($this->postJson('/api/v1/auth/register/request-otp', [
        'name' => 'Rudi Hartono',
        'email' => 'resend.reg@example.com',
        'resend_token' => $resendToken,
    ]), 429, 'RATE_LIMITED');

    $this->travel(61)->seconds();

    // After 60s, valid resend_token succeeds without calling reCAPTCHA again.
    $this->postJson('/api/v1/auth/register/request-otp', [
        'name' => 'Rudi Hartono',
        'email' => 'resend.reg@example.com',
        'resend_token' => $resendToken,
    ])->assertOk();

    Mail::assertSentTimes(OtpCodeMail::class, 2);
});

it('rejects wrong or expired OTP during registration without creating any user', function () {
    config(['services.recaptcha.enabled' => false]);
    Mail::fake();
    RateLimiter::clear('otp-request:fail.otp@example.com');

    $this->postJson('/api/v1/auth/register/request-otp', [
        'name' => 'Siti Nurhaliza',
        'email' => 'fail.otp@example.com',
    ])->assertOk();

    $sentOtp = '';
    Mail::assertSent(OtpCodeMail::class, function (OtpCodeMail $mail) use (&$sentOtp): bool {
        $sentOtp = $mail->otp;

        return true;
    });

    $wrongCode = $sentOtp === '000000' ? '111111' : '000000';
    $wrong = $this->postJson('/api/v1/auth/register/verify', [
        'name' => 'Siti Nurhaliza',
        'email' => 'fail.otp@example.com',
        'otp' => $wrongCode,
    ]);
    assertApiError($wrong, 422, 'VALIDATION_ERROR');
    $wrong->assertJsonStructure(['error' => ['details' => ['fields' => ['otp']]]]);

    $this->travel(301)->seconds();

    $expired = $this->postJson('/api/v1/auth/register/verify', [
        'name' => 'Siti Nurhaliza',
        'email' => 'fail.otp@example.com',
        'otp' => $sentOtp,
    ]);
    assertApiError($expired, 422, 'VALIDATION_ERROR');

    expect(User::query()->where('email', 'fail.otp@example.com')->exists())->toBeFalse();
});

it('links google_id from matching signup_token and ignores mismatched email token', function () {
    config(['services.recaptcha.enabled' => false]);
    Mail::fake();
    RateLimiter::clear('otp-request:google.new@example.com');
    RateLimiter::clear('otp-request:other.email@example.com');

    $token = 'valid-google-signup-token-123';
    Cache::put('google_signup:'.$token, [
        'email' => 'google.new@example.com',
        'name' => 'Google New',
        'google_id' => 'google-id-888',
    ], now()->addMinutes(10));

    // Attempt with mismatched email must NOT attach google-id-888.
    $this->postJson('/api/v1/auth/register/request-otp', [
        'name' => 'Other User',
        'email' => 'other.email@example.com',
    ])->assertOk();

    $otherOtp = '';
    Mail::assertSent(OtpCodeMail::class, function (OtpCodeMail $mail) use (&$otherOtp): bool {
        if ($mail->hasTo('other.email@example.com')) {
            $otherOtp = $mail->otp;

            return true;
        }

        return false;
    });

    $this->postJson('/api/v1/auth/register/verify', [
        'name' => 'Other User',
        'email' => 'other.email@example.com',
        'otp' => $otherOtp,
        'signup_token' => $token,
    ])->assertCreated();

    expect(User::query()->where('email', 'other.email@example.com')->firstOrFail()->google_id)->toBeNull();

    // Matching email attaches google_id when signup_token is still present.
    Cache::put('google_signup:'.$token, [
        'email' => 'google.new@example.com',
        'name' => 'Google New',
        'google_id' => 'google-id-888',
    ], now()->addMinutes(10));

    $this->postJson('/api/v1/auth/register/request-otp', [
        'name' => 'Google New',
        'email' => 'google.new@example.com',
    ])->assertOk();

    $googleOtp = '';
    Mail::assertSent(OtpCodeMail::class, function (OtpCodeMail $mail) use (&$googleOtp): bool {
        if ($mail->hasTo('google.new@example.com')) {
            $googleOtp = $mail->otp;

            return true;
        }

        return false;
    });

    $this->postJson('/api/v1/auth/register/verify', [
        'name' => 'Google New',
        'email' => 'google.new@example.com',
        'otp' => $googleOtp,
        'signup_token' => $token,
    ])->assertCreated();

    expect(User::query()->where('email', 'google.new@example.com')->firstOrFail()->google_id)->toBe('google-id-888');
});
