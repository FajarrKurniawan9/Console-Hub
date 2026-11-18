<?php

namespace App\Services;

use App\Connectors\ConsoleClient;
use App\Connectors\ConsoleResponse;
use App\Models\Console;
use App\Support\ApiException;
use Illuminate\Support\Facades\Log;

/**
 * Forwards resource reads and writes to a console API, limited to configured writable fields.
 */
class ResourceGateway
{
    public function __construct(private ConsoleClient $client, private Audit $audit) {}

    /**
     * @return array{data: list<array<string, mixed>>, next_cursor: string|null, total: int|null}
     */
    public function list(Console $console, string $key, int $page, int $perPage, ?string $search): array
    {
        $resource = $this->resource($console, $key);
        $response = $this->client->request($console, 'GET', $resource['list_path'], null, [
            'query' => array_filter(['page' => $page, 'per_page' => $perPage, 'q' => $search], fn ($v) => $v !== null && $v !== ''),
            'throw' => true,
        ]);

        $rows = $this->rows($console, $response, $resource);
        $total = $response->get('meta.total') ?? $response->get('total');

        if (is_int($total)) {
            return ['data' => $rows, 'next_cursor' => $page * $perPage < $total ? (string) ($page + 1) : null, 'total' => $total];
        }

        if ($search !== null && $search !== '') {
            $needle = mb_strtolower($search);
            $rows = array_values(array_filter($rows, fn (array $row) => collect($row)->contains(
                fn ($value) => is_scalar($value) && str_contains(mb_strtolower((string) $value), $needle)
            )));
        }

        $total = count($rows);

        return [
            'data' => array_slice($rows, ($page - 1) * $perPage, $perPage),
            'next_cursor' => $page * $perPage < $total ? (string) ($page + 1) : null,
            'total' => $total,
        ];
    }

    /**
     * @param  array<string, mixed>  $fields
     * @return array<string, mixed>
     */
    public function update(Console $console, string $key, string $recordId, array $fields): array
    {
        $resource = $this->resource($console, $key);
        $writable = $resource['writable_fields'] ?? [];

        if ($fields === []) {
            throw ApiException::validation(['fields' => ['Tidak ada field yang dikirim.']]);
        }

        $rejected = array_diff(array_keys($fields), $writable);

        if ($rejected !== []) {
            throw ApiException::validation(array_fill_keys(array_values($rejected), ['Field ini tidak boleh diubah.']));
        }

        $path = str_replace('{id}', rawurlencode($recordId), $resource['item_path']);
        $old = $this->record($console, $this->client->request($console, 'GET', $path, null, ['throw' => true]), $resource);

        $write = $this->client->request($console, $resource['update_method'] ?? 'PATCH', $path, $fields);

        if ($write->status === 422) {
            throw ApiException::validation($this->consoleFields($write), "{$console->name} menolak perubahan.", $console->slug);
        }

        if (! $write->successful()) {
            throw $this->client->errorFor($console, $write);
        }

        $new = $this->record($console, $this->client->request($console, 'GET', $path, null, ['throw' => true]), $resource);

        $this->audit->record('resource.updated', $key, $recordId, $console->id, [
            'resource' => $key,
            'record_id' => $recordId,
            'changes' => collect(array_keys($fields))->mapWithKeys(fn (string $field) => [
                $field => ['old' => $old[$field] ?? null, 'new' => $new[$field] ?? null],
            ])->all(),
        ]);

        return $new;
    }

    /**
     * @return array{key: string, label: string, list_path: string, item_path: string, id_field: string, data_path?: string|null, update_method?: string, writable_fields: list<string>}
     */
    public function resource(Console $console, string $key): array
    {
        if (! $console->is_active) {
            throw ApiException::conflict("{$console->name} sedang nonaktif.");
        }

        $resource = collect((array) $console->setting('resources', []))->firstWhere('key', $key);

        if (! is_array($resource)) {
            throw new ApiException(404, 'NOT_FOUND', "Sumber data {$key} tidak ada di {$console->name}.");
        }

        return $resource;
    }

    /**
     * @param  array<string, mixed>  $resource
     * @return list<array<string, mixed>>
     */
    private function rows(Console $console, ConsoleResponse $response, array $resource): array
    {
        $rows = $response->get($resource['data_path'] ?? null);

        if (! is_array($rows) || ! array_is_list($rows)) {
            Log::warning('Unexpected resource list shape', ['console' => $console->slug, 'resource' => $resource['key']]);

            throw ApiException::conflict("Respons {$console->name} untuk {$resource['label']} tidak berisi daftar.");
        }

        return array_values(array_filter($rows, 'is_array'));
    }

    /**
     * Read a single record, unwrapping data_path when the console wraps it the same way as the list.
     *
     * @param  array<string, mixed>  $resource
     * @return array<string, mixed>
     */
    private function record(Console $console, ConsoleResponse $response, array $resource): array
    {
        $body = $response->body;
        $path = $resource['data_path'] ?? null;

        if ($path && is_array($wrapped = data_get($body, $path)) && ! array_is_list($wrapped)) {
            $body = $wrapped;
        }

        return is_array($body) ? $body : [];
    }

    /**
     * Map a console 422 body onto field errors when it exposes them.
     *
     * @return array<string, list<string>>
     */
    private function consoleFields(ConsoleResponse $response): array
    {
        $candidates = [$response->get('errors'), $response->get('error.fields'), $response->get('fields')];

        foreach ($candidates as $errors) {
            if (is_array($errors) && $errors !== [] && ! array_is_list($errors)) {
                return collect($errors)->map(fn ($messages) => array_values(array_map('strval', (array) $messages)))->all();
            }
        }

        $message = $response->get('message') ?? $response->get('error.message');

        return ['fields' => [is_string($message) ? $message : 'Ditolak oleh console.']];
    }
}
