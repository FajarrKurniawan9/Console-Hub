<?php

namespace App\Services\Domain;

use App\Services\Audit;
use App\Services\Sources\SourceClient;
use App\Services\Sources\SourceRegistry;
use App\Support\ApiException;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Read, write and deactivate Items, Productions and People through their owner API (update 1 §6, §7).
 * The three differ only in their references, which live in Enricher::JOINS and ReferenceChecker.
 */
class RecordService
{
    /** Audit subject per resource: `item.created`, `production.updated`, `person.deactivated`. */
    public const SUBJECTS = ['items' => 'item', 'productions' => 'production', 'people' => 'person'];

    public function __construct(
        private SourceRegistry $sources,
        private Enricher $enricher,
        private ReferenceChecker $references,
        private Audit $audit,
    ) {}

    /**
     * @param  'items'|'productions'|'people'  $resource
     * @param  array<string, scalar|null>  $query
     * @return array{data: list<array<string, mixed>>, next_cursor: string|null, unavailable: list<string>}
     */
    public function list(string $resource, array $query): array
    {
        $page = $this->owner($resource)->list($query)->orFail();
        $rows = array_values(array_filter($page['data'], 'is_array'));
        [$rows, $unavailable] = $this->enricher->enrich($resource, $rows);

        return ['data' => $rows, 'next_cursor' => is_string($page['next_cursor']) ? $page['next_cursor'] : null, 'unavailable' => $unavailable];
    }

    /**
     * @param  'items'|'productions'|'people'  $resource
     * @return array<string, mixed>
     */
    public function find(string $resource, string $id): array
    {
        return $this->enricher->enrich($resource, [$this->raw($resource, $id)])[0][0];
    }

    /**
     * @param  'items'|'productions'|'people'  $resource
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public function create(string $resource, array $input): array
    {
        $this->references->assertReferences($resource, $input);
        $created = $this->owner($resource)->write('POST', null, $input);
        $this->record("{$this->subject($resource)}.created", $resource, $created, null, $created);

        return $this->enricher->enrich($resource, [$created])[0][0];
    }

    /**
     * @param  'items'|'productions'|'people'  $resource
     * @param  array<string, mixed>  $input  changed fields plus `expected_version`
     * @return array<string, mixed>
     */
    public function update(string $resource, string $id, array $input): array
    {
        $before = $this->raw($resource, $id);
        $this->references->assertReferences($resource, $input);
        $after = $this->owner($resource)->write('PATCH', $id, $input);
        $changed = array_keys(array_diff_key($input, ['expected_version' => true]));
        $this->record("{$this->subject($resource)}.updated", $resource, $after, array_intersect_key($before, array_flip($changed)), array_intersect_key($after, array_flip($changed)));

        return $this->enricher->enrich($resource, [$after])[0][0];
    }

    /**
     * @param  'items'|'productions'|'people'  $resource
     * @return array<string, mixed>
     */
    public function deactivate(string $resource, string $id, int $expectedVersion, bool $technical): array
    {
        $this->raw($resource, $id);
        $this->references->assertUnused($resource, $id, $technical);
        $after = $this->owner($resource)->write('DELETE', $id, query: ['expected_version' => $expectedVersion]);
        $this->record("{$this->subject($resource)}.deactivated", $resource, $after, ['status' => 'aktif'], ['status' => $after['status'] ?? 'nonaktif']);

        return $this->enricher->enrich($resource, [$after])[0][0];
    }

    /**
     * The record as the owner holds it: 404 NOT_FOUND, or 502/504 when the owner is down.
     *
     * @param  'items'|'productions'|'people'  $resource
     * @return array<string, mixed>
     */
    public function raw(string $resource, string $id): array
    {
        $result = $this->owner($resource)->find($id);

        if ($result->status === 'not_found') {
            throw new ApiException(404, 'NOT_FOUND', 'Data tidak ditemukan.');
        }

        return $result->orFail();
    }

    private function owner(string $resource): SourceClient
    {
        return $this->sources->for($resource);
    }

    private function subject(string $resource): string
    {
        return self::SUBJECTS[$resource];
    }

    /**
     * Audit after the owner already wrote: a failure here is logged, never undone (§6).
     *
     * @param  array<string, mixed>  $record
     * @param  array<string, mixed>|null  $old
     * @param  array<string, mixed>  $new
     */
    private function record(string $action, string $resource, array $record, ?array $old, array $new): void
    {
        try {
            $this->audit->record($action, $this->subject($resource), (string) ($record['id'] ?? ''), $old, ['console' => SourceRegistry::SOURCES[$resource], ...$new]);
        } catch (Throwable $e) {
            Log::error('Audit write failed after a source write', ['action' => $action, 'id' => $record['id'] ?? null, 'exception' => $e::class]);
        }
    }
}
