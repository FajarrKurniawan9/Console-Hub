<?php

namespace App\Services\Domain;

use App\Services\Sources\SourceRegistry;
use App\Support\ApiException;

/**
 * Guards links between the three APIs, which do not check each other (contract §5):
 * references must exist and be `aktif` before a write, and a record still in use cannot be deactivated.
 */
class ReferenceChecker
{
    /** @var array<string, string> */
    private const MISSING = [
        'production_id' => 'Produksi yang dipilih tidak ditemukan atau sudah nonaktif.',
        'responsible_id' => 'Personel yang dipilih tidak ditemukan atau sudah nonaktif.',
        'courier_id' => 'Personel yang dipilih tidak ditemukan atau sudah nonaktif.',
    ];

    /**
     * resource => filter field => [source to ask, used-by type].
     *
     * @var array<string, array<string, array{0: 'items'|'productions', 1: string}>>
     */
    private const USERS = [
        'people' => ['responsible_id' => ['items', 'item'], 'courier_id' => ['productions', 'production']],
        'productions' => ['production_id' => ['items', 'item']],
        'items' => [],
    ];

    public function __construct(private SourceRegistry $sources) {}

    /**
     * Every filled reference in $input must exist and be `aktif`. A source that cannot answer stops
     * the write (502/504): nothing is written unchecked.
     *
     * @param  'items'|'productions'|'people'  $resource
     * @param  array<string, mixed>  $input
     */
    public function assertReferences(string $resource, array $input): void
    {
        $gets = [];

        foreach (Enricher::JOINS[$resource] as [$idField, , $target]) {
            if (is_string($input[$idField] ?? null) && $input[$idField] !== '') {
                $source = $this->sources->for($target);
                $gets[$idField] = [$source, $source->path($input[$idField]), true];
            }
        }

        $missing = [];

        foreach ($gets === [] ? [] : $this->sources->getMany($gets) as $field => $result) {
            $result->orFail();

            if (! $result->ok() || ($result->data['status'] ?? null) !== 'aktif') {
                $missing[$field] = [self::MISSING[$field]];
            }
        }

        if ($missing !== []) {
            throw new ApiException(422, 'REFERENCE_NOT_FOUND', reset($missing)[0], ['fields' => $missing]);
        }
    }

    /**
     * Refuse (409 REFERENCED) when an active record still points at $id. `used_by` only for $technical.
     *
     * @param  'items'|'productions'|'people'  $resource
     */
    public function assertUnused(string $resource, string $id, bool $technical): void
    {
        $gets = [];

        foreach (self::USERS[$resource] as $field => [$target]) {
            $source = $this->sources->for($target);
            $gets[$field] = [$source, $source->listPath([$field => $id, 'status' => 'aktif', 'limit' => 1]), false];
        }

        $usedBy = [];

        foreach ($gets === [] ? [] : $this->sources->getMany($gets) as $field => $result) {
            [$target, $type] = self::USERS[$resource][$field];

            foreach ($result->orFail()['data'] as $record) {
                $usedBy[] = [
                    'source' => $result->source,
                    'type' => $type,
                    'id' => (string) ($record['id'] ?? ''),
                    'name' => $target === 'items' ? (string) ($record['name'] ?? '') : trim(($record['area'] ?? '').' · '.($record['production_type'] ?? ''), ' ·'),
                ];
            }
        }

        if ($usedBy !== []) {
            throw new ApiException(409, 'REFERENCED', 'Data ini masih dipakai oleh data lain, jadi belum bisa dinonaktifkan.', $technical ? ['used_by' => $usedBy] : []);
        }
    }
}
