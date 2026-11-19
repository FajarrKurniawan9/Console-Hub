<?php

namespace App\Services\Sources;

use App\Connectors\Exceptions\ConsoleException;

/**
 * The answer of one source API call: `ok` with data, `not_found`, or `unavailable` with the error.
 */
final class SourceResult
{
    /**
     * @param  'gudang'|'produksi'|'hr'  $source
     * @param  'ok'|'unavailable'|'not_found'  $status
     */
    public function __construct(
        public readonly string $source,
        public readonly string $status,
        public readonly mixed $data = null,
        public readonly ?int $latencyMs = null,
        public readonly ?ConsoleException $error = null,
    ) {}

    public function ok(): bool
    {
        return $this->status === 'ok';
    }

    public function unavailable(): bool
    {
        return $this->status === 'unavailable';
    }

    /**
     * The data, or the source error (502/504) when the source could not answer.
     */
    public function orFail(): mixed
    {
        if ($this->error !== null) {
            throw $this->error;
        }

        return $this->data;
    }
}
