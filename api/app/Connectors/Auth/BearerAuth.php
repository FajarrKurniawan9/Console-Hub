<?php

namespace App\Connectors\Auth;

use App\Connectors\ConsoleClient;
use App\Connectors\Exceptions\ConsoleException;
use App\Models\Console;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Cache;

/**
 * Logs in on first use and caches the token for ttl_seconds - 30.
 */
class BearerAuth implements AuthStrategy
{
    public function __construct(private ConsoleClient $client) {}

    public function apply(PendingRequest $request, Console $console): PendingRequest
    {
        return $request->withToken($this->token($console));
    }

    public function invalidate(Console $console): bool
    {
        Cache::forget(self::cacheKey($console));

        return true;
    }

    public static function cacheKey(Console $console): string
    {
        return "console:{$console->id}:token";
    }

    private function token(Console $console): string
    {
        $key = self::cacheKey($console);
        $cached = Cache::get($key);

        if (is_string($cached) && $cached !== '') {
            return $cached;
        }

        $login = (array) $console->setting('auth.login', []);
        $body = $this->fillSecrets($login['body'] ?? [], $console->credentials);

        $response = $this->client->raw($console, strtoupper($login['method'] ?? 'POST'), (string) ($login['path'] ?? '/auth/login'), $body);

        if (! $response->successful()) {
            throw new ConsoleException('CONSOLE_ERROR', "Login ke {$console->name} gagal (HTTP {$response->status}).", $console->slug, ['status' => $response->status]);
        }

        $token = $response->get($login['token_path'] ?? 'access_token');

        if (! is_string($token) || $token === '') {
            throw new ConsoleException('CONSOLE_ERROR', "Login ke {$console->name} tidak mengembalikan token.", $console->slug);
        }

        $ttl = max(1, (int) ($login['ttl_seconds'] ?? 300) - 30);
        Cache::put($key, $token, $ttl);

        return $token;
    }

    /**
     * Replace "{{secret.x}}" placeholders with values from the console credentials.
     *
     * @param  array<string, string>  $secrets
     */
    private function fillSecrets(mixed $value, array $secrets): mixed
    {
        if (is_array($value)) {
            return array_map(fn ($item) => $this->fillSecrets($item, $secrets), $value);
        }

        if (is_string($value)) {
            return preg_replace_callback('/\{\{\s*secret\.(\w+)\s*\}\}/', fn ($m) => (string) ($secrets[$m[1]] ?? ''), $value);
        }

        return $value;
    }
}
