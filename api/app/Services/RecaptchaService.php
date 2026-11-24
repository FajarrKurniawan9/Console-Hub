<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

class RecaptchaService
{
    private const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

    public function verify(?string $token, ?string $remoteIp = null): bool
    {
        if (! config('services.recaptcha.enabled')) {
            return true;
        }

        if ($token === null || trim($token) === '') {
            return false;
        }

        $secret = (string) config('services.recaptcha.secret_key', '');

        if ($secret === '') {
            return false;
        }

        $payload = [
            'secret' => $secret,
            'response' => $token,
        ];

        if ($remoteIp !== null && $remoteIp !== '') {
            $payload['remoteip'] = $remoteIp;
        }

        try {
            $response = Http::asForm()
                ->timeout(5)
                ->post(self::VERIFY_URL, $payload);

            return $response->successful() && (bool) $response->json('success', false);
        } catch (ConnectionException) {
            return false;
        }
    }
}
