<?php

namespace App\Services\Tx;

/**
 * Everything the coordinator needs before phase 1: what to send, and what to commit.
 */
final readonly class PreparedTx
{
    /**
     * @param  array<string, mixed>  $payload  sent unchanged to every participant
     * @param  array<string, mixed>  $entity  business data after the change (checksum source)
     * @param  array<string, mixed>|null  $old  business data before the change (audit)
     */
    public function __construct(
        public string $entityId,
        public array $payload,
        public int $version,
        public string $checksum,
        public string $label,
        public array $entity,
        public ?array $old = null,
    ) {}
}
