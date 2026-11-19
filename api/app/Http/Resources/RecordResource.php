<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Frontend `Item`, `Production` or `Person` (schemas.ts) from a merged source record.
 * Only the listed fields leave the hub, whatever else a source sends.
 *
 * @property array<string, mixed> $resource
 */
class RecordResource extends JsonResource
{
    /** @var array<string, list<string>> */
    public const FIELDS = [
        'items' => ['id', 'name', 'kind', 'production_id', 'production', 'responsible_id', 'responsible', 'quantity', 'unit'],
        'productions' => ['id', 'area', 'production_type', 'courier_id', 'courier'],
        'people' => ['id', 'name', 'role'],
    ];

    private const STAMPS = ['status', 'version', 'created_at', 'updated_at'];

    /**
     * @param  array<string, mixed>  $record
     */
    public function __construct(array $record, private readonly string $type)
    {
        parent::__construct($record);
    }

    /**
     * @param  list<array<string, mixed>>  $records
     * @return list<self>
     */
    public static function many(string $type, array $records): array
    {
        return array_map(fn (array $record) => new self($record, $type), $records);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $out = [];

        foreach ([...self::FIELDS[$this->type], ...self::STAMPS] as $field) {
            $out[$field] = $this->resource[$field] ?? null;
        }

        return $out;
    }
}
