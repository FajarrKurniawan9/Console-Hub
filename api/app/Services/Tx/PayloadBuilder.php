<?php

namespace App\Services\Tx;

use App\Services\Console\ConsoleRegistry;
use App\Support\ApiException;
use Illuminate\Support\Arr;

/**
 * Shared steps of every operation: read the owner, check the version, finish the PreparedTx.
 */
class PayloadBuilder
{
    public function __construct(private ConsoleRegistry $registry) {}

    /**
     * Current business fields of a record at its owner, after checking `expected_version`.
     *
     * @param  'divisions'|'employees'|'items'|'orders'  $resource
     * @param  list<string>  $fields
     * @return array<string, mixed>
     */
    public function current(string $resource, string $id, array $fields, int $expectedVersion): array
    {
        $data = $this->registry->readOwned($resource, $id);
        $version = (int) ($data['version'] ?? 0);

        if ($version !== $expectedVersion) {
            throw new ApiException(409, 'VERSION_CONFLICT', 'Data ini baru saja diubah orang lain. Muat ulang lalu coba lagi.', details: ['current_version' => $version]);
        }

        return Arr::only($data, $fields);
    }

    /**
     * @param  'divisions'|'employees'|'items'|'orders'  $resource
     * @return array<string, mixed>
     */
    public function read(string $resource, string $id): array
    {
        return $this->registry->readOwned($resource, $id);
    }

    /**
     * @param  array<string, mixed>  $entity
     * @param  array<string, mixed>  $payload
     * @param  array<string, mixed>|null  $old
     */
    public function finish(array $entity, int $version, array $payload, string $label, ?array $old = null): PreparedTx
    {
        return new PreparedTx((string) $entity['id'], $payload, $version, Checksum::of($entity), $label, $entity, $old);
    }
}
