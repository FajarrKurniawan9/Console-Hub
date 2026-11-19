<?php

namespace App\Connectors;

use App\Connectors\Exceptions\ConsoleException;
use App\Models\Console;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Sleep;
use InvalidArgumentException;
use Throwable;

/**
 * The single gateway for every HTTP call the hub makes to a source API.
 */
class ConsoleClient
{
    /** Delays (seconds) between automatic GET retries: one retry, only when the connection failed. */
    private const READ_RETRY_DELAYS = [1];

    public function __construct(private HostGuard $guard) {}

    /**
     * Send an authenticated request to the source and map transport failures to ConsoleException.
     * A GET is retried once when the connection failed; a timeout is not retried (8 s is already long).
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

                break;
            } catch (ConsoleException $e) {
                if (! ($e->details['connection'] ?? false) || ! isset($delays[$attempt])) {
                    throw $e;
                }

                Sleep::for($delays[$attempt++])->seconds();
            }
        }

        if (($opts['throw'] ?? false) && ! $response->successful()) {
            throw $this->errorFor($console, $response);
        }

        return $response;
    }

    /**
     * Send a request without auth, retries or error mapping of non-2xx (public /health).
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
        return new ConsoleException('SOURCE_UNREACHABLE', "{$console->name} menjawab HTTP {$response->status}.", $console->slug, ['status' => $response->status, 'body' => $response->body]);
    }

    /**
     * Send authenticated GETs in parallel. A connection error is retried once (like `request`);
     * failures come back as ConsoleException values (never thrown), so one dead source never hides
     * the answers of the others.
     *
     * @param  array<string, array{0: Console, 1: string}>  $gets  key => [console, path with query]
     * @return array<string, ConsoleResponse|ConsoleException>
     */
    public function pool(array $gets): array
    {
        $results = $this->poolOnce($gets);
        $retry = array_filter($gets, fn ($get, $key) => $results[$key] instanceof ConsoleException && ($results[$key]->details['connection'] ?? false), ARRAY_FILTER_USE_BOTH);

        if ($retry !== []) {
            Sleep::for(self::READ_RETRY_DELAYS[0])->seconds();
            $results = array_replace($results, $this->poolOnce($retry));
        }

        return $results;
    }

    /**
     * @param  array<string, array{0: Console, 1: string}>  $gets
     * @return array<string, ConsoleResponse|ConsoleException>
     */
    private function poolOnce(array $gets): array
    {
        $results = [];
        $sendable = [];
        $timeout = (int) config('consolehub.default_timeout_seconds', 8);

        foreach ($gets as $key => [$console, $path]) {
            if (! $console->is_active) {
                $results[$key] = new ConsoleException('SOURCE_UNREACHABLE', "{$console->name} dinonaktifkan di hub.", $console->slug);
            } elseif ($reason = $this->guard->violation($console->base_url)) {
                $results[$key] = new ConsoleException('SOURCE_UNREACHABLE', "{$console->name} diblokir: {$reason}", $console->slug);
            } else {
                $sendable[$key] = [$console, $this->url($console, $path)];
            }
        }

        if ($sendable === []) {
            return $results;
        }

        $responses = Http::pool(function (Pool $pool) use ($sendable, $timeout) {
            foreach ($sendable as $key => [$console, $url]) {
                $this->authenticate($this->configure($pool->as((string) $key), $timeout), $console)->get($url);
            }
        });

        foreach ($sendable as $key => [$console, $url]) {
            $response = $responses[$key] ?? null;

            $results[$key] = match (true) {
                $response instanceof Response => ConsoleResponse::from($response, (int) round(($response->transferStats?->getTransferTime() ?? 0) * 1000), $url),
                $response instanceof ConnectionException => $this->connectionError($console, $response, $timeout),
                default => $this->unexpected($console, $response),
            };
        }

        return $results;
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

    /**
     * Attach the console's service key. `api_key` (X-Service-Key) is used today; `bearer` (static token)
     * and `basic` ("user:password") are kept for consoles registered later.
     */
    public function authenticate(PendingRequest $request, Console $console): PendingRequest
    {
        $key = (string) $console->service_key;

        return match ($console->auth_type) {
            'api_key' => $request->withHeaders(['X-Service-Key' => $key]),
            'bearer' => $request->withToken($key),
            'basic' => $request->withBasicAuth(...array_pad(explode(':', $key, 2), 2, '')),
            default => throw new InvalidArgumentException("Tipe auth tidak dikenal: {$console->auth_type}"),
        };
    }

    /**
     * @param  array<string, mixed>|list<mixed>|null  $body
     * @param  array<string, mixed>  $opts
     */
    private function send(Console $console, string $method, string $path, ?array $body, array $opts, bool $useAuth): ConsoleResponse
    {
        $pending = $this->pending($opts);

        return $this->dispatch($console, $useAuth ? $this->authenticate($pending, $console) : $pending, $method, $path, $body, $opts);
    }

    /**
     * @param  array<string, mixed>  $opts
     */
    private function pending(array $opts): PendingRequest
    {
        return $this->configure(Http::createPendingRequest(), (int) ($opts['timeout'] ?? config('consolehub.default_timeout_seconds', 8)));
    }

    /**
     * Headers and limits shared by every console call: JSON, request id, acting user, timeouts, no redirects.
     */
    private function configure(PendingRequest $request, int $timeout): PendingRequest
    {
        return $request->acceptJson()
            ->withHeaders(array_filter([
                'X-Request-Id' => Context::get('request_id'),
                'X-Acting-User' => (string) (Context::get('acting_user') ?? Auth::id() ?? ''),
            ]))
            ->timeout($timeout)
            ->connectTimeout(min(5, $timeout))
            ->withoutRedirecting();
    }

    /**
     * @param  array<string, mixed>|list<mixed>|null  $body
     * @param  array<string, mixed>  $opts
     */
    private function dispatch(Console $console, PendingRequest $pending, string $method, string $path, ?array $body, array $opts): ConsoleResponse
    {
        if ($reason = $this->guard->violation($console->base_url)) {
            throw new ConsoleException('SOURCE_UNREACHABLE', "{$console->name} diblokir: {$reason}", $console->slug);
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

    private function unexpected(Console $console, mixed $failure): ConsoleException
    {
        if ($failure instanceof Throwable) {
            Log::error('Console call failed unexpectedly', ['console' => $console->slug, 'exception' => $failure::class, 'message' => $failure->getMessage()]);
        }

        return new ConsoleException('SOURCE_UNREACHABLE', "{$console->name} gagal dipanggil.", $console->slug);
    }

    private function connectionError(Console $console, ConnectionException $e, int $timeout): ConsoleException
    {
        $isTimeout = str_contains($e->getMessage(), 'cURL error 28') || stripos($e->getMessage(), 'timed out') !== false;

        return $isTimeout
            ? new ConsoleException('SOURCE_TIMEOUT', "{$console->name} tidak merespons dalam {$timeout} detik", $console->slug)
            : new ConsoleException('SOURCE_UNREACHABLE', "{$console->name} tidak dapat dihubungi.", $console->slug, ['connection' => true]);
    }
}
