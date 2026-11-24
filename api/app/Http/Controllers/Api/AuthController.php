<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RequestOtpRequest;
use App\Http\Requests\VerifyOtpRequest;
use App\Http\Resources\AuthUserResource;
use App\Mail\OtpCodeMail;
use App\Models\OtpCode;
use App\Models\User;
use App\Services\AuthTokenService;
use App\Services\RecaptchaService;
use App\Support\ApiException;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    private const OTP_TTL_SECONDS = 300;

    private const OTP_RATE_LIMIT_SECONDS = 60;

    private const OTP_MAX_ATTEMPTS = 5;

    public function login(LoginRequest $request, AuthTokenService $authTokens): JsonResponse
    {
        $email = strtolower(trim($request->string('email')->toString()));
        $user = User::query()->with('role')->whereRaw('LOWER(email) = ?', [$email])->first();

        // Same answer for an unknown email and a wrong password.
        if (! $user || $user->password === null || ! Hash::check($request->string('password')->toString(), $user->password)) {
            throw new ApiException(401, 'UNAUTHENTICATED', 'Email atau sandi salah.');
        }

        if (! $user->is_active) {
            throw new ApiException(403, 'FORBIDDEN', 'Akun Anda dinonaktifkan. Hubungi Admin IT untuk mengaktifkannya.');
        }

        return response()->json($authTokens->issue($user, 'password'));
    }

    public function requestOtp(RequestOtpRequest $request, RecaptchaService $recaptcha): JsonResponse
    {
        $recaptchaToken = $request->string('recaptcha_token')->toString();

        if (! $recaptcha->verify($recaptchaToken !== '' ? $recaptchaToken : null, $request->ip())) {
            throw ApiException::validation(
                ['recaptcha_token' => ['Verifikasi reCAPTCHA gagal. Silakan coba lagi.']],
                'Verifikasi reCAPTCHA gagal. Silakan coba lagi.',
            );
        }

        $email = strtolower(trim($request->string('email')->toString()));
        $user = User::query()->whereRaw('LOWER(email) = ?', [$email])->first();

        if (! $user) {
            throw new ApiException(404, 'NOT_FOUND', 'Email tidak terdaftar di sistem. Hubungi Admin IT.');
        }

        if (! $user->is_active) {
            throw new ApiException(403, 'FORBIDDEN', 'Akun Anda dinonaktifkan. Hubungi Admin IT untuk mengaktifkannya.');
        }

        $rateLimitKey = 'otp-request:'.$email;

        if (RateLimiter::tooManyAttempts($rateLimitKey, 1)) {
            $retryAfter = max(1, RateLimiter::availableIn($rateLimitKey));

            return ApiResponse::error(
                429,
                'RATE_LIMITED',
                "Terlalu banyak permintaan kode OTP. Coba lagi dalam {$retryAfter} detik.",
                ['retry_after' => $retryAfter],
            )->header('Retry-After', (string) $retryAfter);
        }

        $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $now = now();

        DB::transaction(function () use ($email, $otp, $now): void {
            OtpCode::query()
                ->where('email', $email)
                ->whereNull('used_at')
                ->update(['used_at' => $now]);

            OtpCode::query()->create([
                'email' => $email,
                'code_hash' => Hash::make($otp),
                'attempts' => 0,
                'expires_at' => $now->copy()->addSeconds(self::OTP_TTL_SECONDS),
            ]);
        });

        Mail::to($user->email)->send(new OtpCodeMail($otp, $user->name));

        RateLimiter::hit($rateLimitKey, self::OTP_RATE_LIMIT_SECONDS);

        return response()->json([
            'data' => [
                'message' => 'Kode OTP telah dikirim ke email Anda.',
                'expires_in' => self::OTP_TTL_SECONDS,
            ],
            'message' => 'Kode OTP telah dikirim ke email Anda.',
            'expires_in' => self::OTP_TTL_SECONDS,
        ]);
    }

    public function verifyOtp(VerifyOtpRequest $request, AuthTokenService $authTokens): JsonResponse
    {
        $email = strtolower(trim($request->string('email')->toString()));
        $otp = $request->string('otp')->toString();

        $status = DB::transaction(function () use ($email, $otp): string {
            $otpRecord = OtpCode::query()
                ->where('email', $email)
                ->whereNull('used_at')
                ->where('expires_at', '>', now())
                ->latest('id')
                ->lockForUpdate()
                ->first();

            if (! $otpRecord) {
                return 'expired';
            }

            if ($otpRecord->attempts >= self::OTP_MAX_ATTEMPTS) {
                $otpRecord->used_at = now();
                $otpRecord->save();

                return 'too_many_attempts';
            }

            if (! Hash::check($otp, $otpRecord->code_hash)) {
                $otpRecord->attempts++;

                if ($otpRecord->attempts >= self::OTP_MAX_ATTEMPTS) {
                    $otpRecord->used_at = now();
                    $otpRecord->save();

                    return 'too_many_attempts';
                }

                $otpRecord->save();

                return 'invalid';
            }

            $otpRecord->used_at = now();
            $otpRecord->save();

            return 'verified';
        });

        if ($status === 'expired') {
            throw ApiException::validation(
                ['otp' => ['Kode OTP tidak valid atau sudah kedaluwarsa.']],
                'Kode OTP tidak valid atau sudah kedaluwarsa.',
            );
        }

        if ($status === 'too_many_attempts') {
            throw new ApiException(429, 'RATE_LIMITED', 'Terlalu banyak percobaan salah. Silakan minta kode OTP baru.');
        }

        if ($status === 'invalid') {
            throw ApiException::validation(
                ['otp' => ['Kode OTP tidak valid.']],
                'Kode OTP tidak valid.',
            );
        }

        $user = User::query()->with('role')->whereRaw('LOWER(email) = ?', [$email])->first();

        if (! $user) {
            throw new ApiException(404, 'NOT_FOUND', 'Email tidak terdaftar di sistem. Hubungi Admin IT.');
        }

        if (! $user->is_active) {
            throw new ApiException(403, 'FORBIDDEN', 'Akun Anda dinonaktifkan. Hubungi Admin IT untuk mengaktifkannya.');
        }

        return response()->json($authTokens->issue($user, 'otp'));
    }

    public function logout(Request $request): Response
    {
        $token = $request->user()?->currentAccessToken();

        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }

        return response()->noContent();
    }

    public function me(Request $request): AuthUserResource
    {
        /** @var User $user */
        $user = $request->user();

        return new AuthUserResource($user->load('role'));
    }
}
