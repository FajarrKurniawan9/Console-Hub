<?php

namespace App\Services\Sources;

use App\Connectors\ConsoleClient;
use App\Connectors\ConsoleResponse;
use App\Connectors\Exceptions\ConsoleException;
use App\Models\Console;
use App\Support\ApiException;

/**
 * One source API and the resource it owns (`/api/v1/{resource}`), per `kontrak-3-api-console-hub-v1.md`.
 */
class SourceClient
{
    /** `?ids=` and `?limit=` accept at most this many. */
    public const MAX_IDS = 100;

    /**
     * @param  'gudang'|'produksi'|'hr'  $source
     * @param  'items'|'productions'|'people'  $resource
     */
    public function __construct(
        public readonly string $source,
        public readonly string $resource,
        private readonly ?Console $console,
        private readonly ConsoleClient $client,
    ) {}

    /**
     * `GET /{resource}/{id}`.
     */
    public function find(string $id): SourceResult
    {
        return $this->result($this->call('GET', $this->path($id)), single: true);
    }

    /**
     * `GET /{resource}?...`; data is `{data: list, next_cursor}`.
     *
     * @param  array<string, scalar|null>  $query
     */
    public function list(array $query = []): SourceResult
    {
        return $this->result($this->call('GET', $this->listPath($query)), single: false);
    }

    /**
     * Path of `GET /{resource}?...` (for parallel calls through SourceRegistry::getMany).
     *
     * @param  array<string, scalar|null>  $query
     */
    public function listPath(array $query): string
    {
        $query = array_filter($query, fn ($v) => $v !== null && $v !== '');

        return $this->path().($query === [] ? '' : '?'.http_build_query($query));
    }

    /**
     * Path of `GET /{resource}?ids=` for at most MAX_IDS ids (any status).
     *
     * @param  list<string>  $ids
     */
    public function idsPath(array $ids): string
    {
        return $this->listPath(['ids' => implode(',', $ids), 'status' => 'all', 'limit' => self::MAX_IDS]);
    }

    /**
     * POST, PATCH or DELETE. Source errors the user can act on come back as ApiException:
     * 404 NOT_FOUND, 409 VERSION_CONFLICT, 409 DUPLICATE (as CONFLICT), 422 VALIDATION_ERROR.
     *
     * @param  array<string, mixed>|null  $body
     * @param  array<string, scalar>  $query
     * @return array<string, mixed>
     */
    public function write(string $method, ?string $id, ?array $body = null, array $query = []): array
    {
        $response = $this->call($method, $this->path($id).($query === [] ? '' : '?'.http_build_query($query)), $body);

        if ($response instanceof ConsoleException) {
            throw $response;
        }

        $data = $response->get('data');

        if ($response->successful() && is_array($data)) {
            return $data;
        }

        throw $this->writeError($response);
    }

    /**
     * Turn a raw pooled answer into a SourceResult.
     */
    public function result(ConsoleResponse|ConsoleException $response, bool $single): SourceResult
    {
        if ($response instanceof ConsoleException) {
            return new SourceResult($this->source, 'unavailable', error: $response);
        }

        if ($single && $response->status === 404) {
            return new SourceResult($this->source, 'not_found', latencyMs: $response->latencyMs);
        }

        $data = $response->get('data');

        if (! $response->successful() || ! is_array($data)) {
            return new SourceResult($this->source, 'unavailable', latencyMs: $response->latencyMs, error: $this->errorFor($response));
        }

        return new SourceResult($this->source, 'ok', $single ? $data : ['data' => $data, 'next_cursor' => $response->get('meta.next_cursor')], $response->latencyMs);
    }

    /**
     * The registered console, or null when it is missing from the registry.
     */
    public function console(): ?Console
    {
        return $this->console;
    }

    public function path(?string $id = null): string
    {
        return "/api/v1/{$this->resource}".($id === null ? '' : '/'.rawurlencode($id));
    }

    /**
     * @param  array<string, mixed>|null  $body
     */
    private function call(string $method, string $path, ?array $body = null): ConsoleResponse|ConsoleException
    {
        if ($this->console === null || ! $this->console->is_active) {
            return $this->missing();
        }

        try {
            return $this->client->request($this->console, $method, $path, $body);
        } catch (ConsoleException $e) {
            return $e;
        }
    }

    public function missing(): ConsoleException
    {
        return new ConsoleException('SOURCE_UNREACHABLE', "Sumber {$this->source} belum terdaftar atau dinonaktifkan di hub.", $this->source);
    }

    private function errorFor(ConsoleResponse $response): ConsoleException
    {
        return $this->console === null ? $this->missing() : $this->client->errorFor($this->console, $response);
    }

    private function writeError(ConsoleResponse $response): ApiException|ConsoleException
    {
        $code = $response->get('error.code');
        $fields = $response->get('error.details.fields');

        return match (true) {
            $response->status === 404 => new ApiException(404, 'NOT_FOUND', 'Data tidak ditemukan.'),
            $code === 'VERSION_CONFLICT' => new ApiException(409, 'VERSION_CONFLICT', 'Data ini baru saja diubah orang lain. Muat ulang lalu coba lagi.', array_filter(['current_version' => $response->get('error.details.current_version')], fn ($v) => $v !== null)),
            $code === 'DUPLICATE' => new ApiException(409, 'CONFLICT', 'Data yang sama sudah ada.'),
            $response->status === 422 && is_array($fields) => new ApiException(422, 'VALIDATION_ERROR', 'Input tidak valid.', ['fields' => $fields]),
            default => $this->errorFor($response),
        };
    }
}
