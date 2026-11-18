<?php

namespace App\Support;

use RuntimeException;

/**
 * A domain error that maps directly onto the API error envelope.
 */
class ApiException extends RuntimeException
{
    /**
     * @param  array<string, list<string>>  $fields
     */
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly array $fields = [],
        public readonly ?string $console = null,
    ) {
        parent::__construct($message);
    }

    public static function conflict(string $message): self
    {
        return new self(409, 'CONFLICT', $message);
    }

    /**
     * @param  array<string, list<string>>  $fields
     */
    public static function validation(array $fields, string $message = 'Input tidak valid.', ?string $console = null): self
    {
        return new self(422, 'VALIDATION_FAILED', $message, $fields, $console);
    }
}
