<?php

namespace App\Services\Domain;

use App\Services\Sources\SourceClient;
use App\Services\Sources\SourceRegistry;

/**
 * Fills the merged parts of Items (`production`, `responsible`) and Productions (`courier`) with one
 * `?ids=` call per source (split per 100 ids), all sources in parallel.
 */
class Enricher
{
    /**
     * resource => list of [id field, merged field, target resource].
     *
     * @var array<string, list<array{0: string, 1: string, 2: 'productions'|'people'}>>
     */
    public const JOINS = [
        'items' => [['production_id', 'production', 'productions'], ['responsible_id', 'responsible', 'people']],
        'productions' => [['courier_id', 'courier', 'people']],
        'people' => [],
    ];

    public function __construct(private SourceRegistry $sources) {}

    /**
     * @param  'items'|'productions'|'people'  $resource
     * @param  list<array<string, mixed>>  $rows
     * @return array{0: list<array<string, mixed>>, 1: list<string>} rows with merged parts, unavailable sources
     */
    public function enrich(string $resource, array $rows): array
    {
        $joins = self::JOINS[$resource];
        $wanted = [];

        foreach ($joins as [$idField, , $target]) {
            foreach ($rows as $row) {
                if (is_string($row[$idField] ?? null) && $row[$idField] !== '') {
                    $wanted[$target][$row[$idField]] = true;
                }
            }
        }

        $gets = [];

        foreach ($wanted as $target => $ids) {
            foreach (array_chunk(array_keys($ids), SourceClient::MAX_IDS) as $i => $chunk) {
                $source = $this->sources->for($target);
                $gets["{$target}:{$i}"] = [$source, $source->idsPath($chunk), false];
            }
        }

        $found = [];
        $unavailable = [];

        foreach ($gets === [] ? [] : $this->sources->getMany($gets) as $key => $result) {
            $target = explode(':', $key)[0];

            if (! $result->ok()) {
                $unavailable[$result->source] = true;

                continue;
            }

            foreach ($result->data['data'] as $record) {
                if (is_array($record) && isset($record['id'])) {
                    $found[$target][$record['id']] = $record;
                }
            }
        }

        foreach ($rows as &$row) {
            foreach ($joins as [$idField, $merged, $target]) {
                $record = $found[$target][$row[$idField] ?? ''] ?? null;
                $row[$merged] = $record === null ? null : self::ref($target, $record);
            }
        }

        return [$rows, array_keys($unavailable)];
    }

    /**
     * `PersonRef {id, name, role}` or `ProductionRef {id, area, production_type}`.
     *
     * @param  array<string, mixed>  $record
     * @return array<string, mixed>
     */
    public static function ref(string $resource, array $record): array
    {
        $fields = $resource === 'people' ? ['id', 'name', 'role'] : ['id', 'area', 'production_type'];

        return array_combine($fields, array_map(fn (string $f) => (string) ($record[$f] ?? ''), $fields));
    }
}
