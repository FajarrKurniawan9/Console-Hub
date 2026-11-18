<?php

namespace App\Connectors;

use App\Connectors\Auth\ApiKeyAuth;
use App\Connectors\Auth\AuthStrategy;
use App\Connectors\Auth\BasicAuth;
use App\Connectors\Auth\BearerAuth;
use App\Connectors\Exceptions\ConsoleException;
use App\Models\Console;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Sleep;
use InvalidArgumentException;

/**
 * The single gateway for every HTTP call the portal makes to a console.
 */
class ConsoleClient
{
    /** Status codes worth retrying for idempotent reads. */
    public const RETRYABLE_STATUSES = [429, 502, 503, 504];

    /** Delays (seconds) between automatic GET retries. */
    private const READ_RETRY_DELAYS = [1, 2];

    public function __construct(private HostGuard $guard) {}

    /**
     * Send an authenticated request to the console and map transport failures to ConsoleException.
     *
     * Non-2xx responses are returned (not thrown) unless $opts['throw'] is true, so callers can
     * decide what counts as success.
     *
     * @param  array<string, mixed>|list<mixed>|null  $body
     * @param  array{timeout?: int, query?: array<string, mixed>, throw?: bool, retry?: bool, auth?: bool}  $opts
     */
    public function request(Console $console, string $method, string $path, ?array $body = null, array $opts = []): ConsoleResponse
    {
        $method = strtoupper($method);
        $useAuth = $opts['auth'] ?? true;
        $retryReads = ($opts['retry'] ?? true) && $method === 'GET';
        $delays = $retryReads ? self::READ_RETRY_DELAYS : [];
        $attempt = 0;

        while (true) {
            try {
                $response = $this->send($console, $method, $path, $body, $opts, $useAuth);
                $retryable = in_array($response->status, self::RETRYABLE_STATUSES, true);
            } catch (ConsoleException $e) {
                if (! in_array($e->errorCode, ['CONSOLE_TIMEOUT', 'CONSOLE_UNREACHABLE'], true) || ! isset($delays[$attempt])) {
                    throw $e;
                }
                $response = null;
                $retryable = true;
            }

            if ($retryable && isset($delays[$attempt])) {
                Sleep::for($delays[$attempt++])->seconds();

                continue;
            }

            break;
        }

        /** @var ConsoleResponse $response */
        if (($opts['throw'] ?? false) && ! $response->successful()) {
            throw $this->errorFor($console, $response);
        }

        return $response;
    }

    /**
     * Send a request without auth, retries or error mapping of non-2xx (used for bearer login and public health).
     *
     * @param  array<string, mixed>|list<mixed>|null  $body
     * @param  array{timeout?: int, query?: array<string, mixed>}  $opts
     */
    public function raw(Console $console, string $method, string $path, ?array $body = null, array $opts = []): ConsoleResponse
    {
        return $this->dispatch($console, $this->pending($opts), strtoupper($method), $path, $body, $opts);
    }

    /**
     * Build the exception describing a non-2xx console response.
     */
    public function errorFor(Console $console, ConsoleResponse $response): ConsoleException
    {
        if ($response->status === 503) {
            return new ConsoleException('CONSOLE_UNREACHABLE', "{$console->name} sedang tidak tersedia (HTTP 503).", $console->slug, ['status' => 503, 'body' => $response->body]);
        }

        return new ConsoleException('CONSOLE_ERROR', "{$console->name} menjawab HTTP {$response->status}.", $console->slug, ['status' => $response->status, 'body' => $response->body]);
    }

    /**
     * Join base URL and a relative path, rejecting absolute URLs and traversal.
     */
    public function url(Console $console, string $path): string
    {
        if (! str_starts_with($path, '/') || str_starts_with($path, '//') || preg_match('#^[a-z][a-z0-9+.-]*:#i', $path) || preg_match('#(^|/)\.\.(/|$|\?)#', $path) || str_contains($path, '\\')) {
            throw new InvalidArgumentException("Path console harus relatif dan diawali '/': {$path}");
        }

        return rtrim($console->base_url, '/').$path;
    }

    public function authFor(Console $console): AuthStrategy
    {
        return match ($console->auth_type) {
            'api_key' => new ApiKeyAuth,
            'basic' => new BasicAuth,
            'bearer' => new BearerAuth($this),
            default => throw new InvalidArgumentException("Tipe auth tidak dikenal: {$console->auth_type}"),
        };
    }

    /**
     * @param  array<string, mixed>|list<mixed>|null  $body
     * @param  array<string, mixed>  $opts
     */
    private function send(Console $console, string $method, string $path, ?array $body, array $opts, bool $useAuth): ConsoleResponse
    {
        if (! $useAuth) {
            return $this->raw($console, $method, $path, $body, $opts);
        }

        $auth = $this->authFor($console);
        $response = $this->dispatch($console, $auth->apply($this->pending($opts), $console), $method, $path, $body, $opts);

        if ($response->status === 401 && $auth->invalidate($console)) {
            $response = $this->dispatch($console, $auth->apply($this->pending($opts), $console), $method, $path, $body, $opts);
        }

        return $response;
    }

    /**
     * @param  array<string, mixed>  $opts
     */
    private function pending(array $opts): PendingRequest
    {
        return Http::acceptJson()
            ->timeout((int) ($opts['timeout'] ?? config('consolehub.default_timeout_seconds', 8)))
            ->connectTimeout(5)
            ->withoutRedirecting();
    }

    /**
     * @param  array<string, mixed>|list<mixed>|null  $body
     * @param  array<string, mixed>  $opts
     */
    private function dispatch(Console $console, PendingRequest $pending, string $method, string $path, ?array $body, array $opts): ConsoleResponse
    {
        if ($reason = $this->guard->violation($console->base_url)) {
            throw new ConsoleException('CONSOLE_UNREACHABLE', "{$console->name} diblokir: {$reason}", $console->slug);
        }

        $url = $this->url($console, $path);
        $options = [];

        if (! empty($opts['query'])) {
            $options['query'] = $opts['query'];
        }

        if ($body !== null && $method !== 'GET') {
            $options['json'] = $body;
        }

        $started = hrtime(true);

        try {
            $response = $pending->send($method, $url, $options);
        } catch (ConnectionException $e) {
            throw $this->connectionError($console, $e, (int) ($opts['timeout'] ?? config('consolehub.default_timeout_seconds', 8)));
        }

        return ConsoleResponse::from($response, (int) round((hrtime(true) - $started) / 1e6), $url);
    }

    private function connectionError(Console $console, ConnectionException $e, int $timeout): ConsoleException
    {
        $isTimeout = str_contains($e->getMessage(), 'cURL error 28') || stripos($e->getMessage(), 'timed out') !== false;

        return $isTimeout
            ? new ConsoleException('CONSOLE_TIMEOUT', "{$console->name} tidak merespons dalam {$timeout} detik", $console->slug)
            : new ConsoleException('CONSOLE_UNREACHABLE', "{$console->name} tidak dapat dihubungi.", $console->slug);
    }
}
