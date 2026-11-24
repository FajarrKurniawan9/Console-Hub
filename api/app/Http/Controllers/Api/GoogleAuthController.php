<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\GoogleExchangeRequest;
use App\Models\User;
use App\Services\AuthTokenService;
use App\Support\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\AbstractProvider;
use Symfony\Component\HttpFoundation\RedirectResponse as SymfonyRedirectResponse;
use Throwable;

class GoogleAuthController extends Controller
{
    private const OAUTH_CODE_CACHE_PREFIX = 'google_oauth_code:';

    private const OAUTH_CODE_TTL_SECONDS = 60;

    public function redirect(): SymfonyRedirectResponse
    {
        /** @var AbstractProvider $driver */
        $driver = Socialite::driver('google');

        return $driver->stateless()->redirect();
    }

    public function callback(): RedirectResponse
    {
        try {
            /** @var AbstractProvider $driver */
            $driver = Socialite::driver('google');
            $googleUser = $driver->stateless()->user();
        } catch (Throwable) {
            return redirect()->away($this->frontendCallbackUrl(['error' => 'oauth_failed']));
        }

        $googleEmail = $googleUser->getEmail();

        if (! is_string($googleEmail) || trim($googleEmail) === '') {
            return redirect()->away($this->frontendCallbackUrl(['error' => 'account_not_registered']));
        }

        $email = strtolower(trim($googleEmail));
        $user = User::query()->whereRaw('LOWER(email) = ?', [$email])->first();

        if (! $user) {
            return redirect()->away($this->frontendCallbackUrl(['error' => 'account_not_registered']));
        }

        if (! $user->is_active) {
            return redirect()->away($this->frontendCallbackUrl(['error' => 'account_inactive']));
        }

        $googleId = trim((string) $googleUser->getId());

        if ($user->google_id === null && $googleId !== '') {
            $user->forceFill(['google_id' => $googleId])->save();
        }

        $code = Str::random(64);
        Cache::put(self::OAUTH_CODE_CACHE_PREFIX.$code, $user->id, now()->addSeconds(self::OAUTH_CODE_TTL_SECONDS));

        return redirect()->away($this->frontendCallbackUrl(['code' => $code]));
    }

    public function exchange(GoogleExchangeRequest $request, AuthTokenService $authTokens): JsonResponse
    {
        $code = $request->string('code')->toString();
        $userId = Cache::pull(self::OAUTH_CODE_CACHE_PREFIX.$code);

        if (! is_int($userId) && ! is_string($userId)) {
            throw ApiException::validation(
                ['code' => ['Sesi login Google tidak valid atau kedaluwarsa.']],
                'Sesi login Google tidak valid atau kedaluwarsa.',
            );
        }

        $user = User::query()->with('role')->find($userId);

        if (! $user) {
            throw ApiException::validation(
                ['code' => ['Sesi login Google tidak valid atau kedaluwarsa.']],
                'Sesi login Google tidak valid atau kedaluwarsa.',
            );
        }

        if (! $user->is_active) {
            throw new ApiException(403, 'FORBIDDEN', 'Akun Anda dinonaktifkan. Hubungi Admin IT untuk mengaktifkannya.');
        }

        return response()->json($authTokens->issue($user, 'google'));
    }

    /**
     * @param  array<string, string>  $query
     */
    private function frontendCallbackUrl(array $query): string
    {
        $baseUrl = rtrim((string) config('services.frontend_url', 'http://localhost:5173'), '/');

        return $baseUrl.'/auth/google/callback?'.http_build_query($query);
    }
}
