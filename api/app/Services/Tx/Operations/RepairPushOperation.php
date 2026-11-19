<?php

namespace App\Services\Tx\Operations;

use App\Services\Tx\Checksum;
use App\Services\Tx\PreparedTx;

/**
 * repair.push — resend the owner's copy of one record to one lagging console.
 * payload {entity_type, entity, version, checksum}; the owner's data is never changed.
 */
class RepairPushOperation implements Operation
{
    /**
     * @param  array<string, mixed>  $entity  owner's business fields
     */
    public function __construct(private string $entityType, private array $entity, private int $version, private string $label) {}

    public function name(): string
    {
        return 'repair.push';
    }

    public function entityType(): string
    {
        return $this->entityType;
    }

    public function creates(): bool
    {
        return false;
    }

    public function prepare(array $input, ?string $targetId): PreparedTx
    {
        $checksum = Checksum::of($this->entity);

        return new PreparedTx(
            (string) $this->entity['id'],
            ['entity_type' => $this->entityType, 'entity' => $this->entity, 'version' => $this->version, 'checksum' => $checksum],
            $this->version,
            $checksum,
            $this->label,
            $this->entity,
        );
    }
}
