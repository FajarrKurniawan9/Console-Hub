<?php

namespace App\Connectors\Exceptions;

use RuntimeException;

/**
 * A source API could not answer: `SOURCE_UNREACHABLE` (502) or `SOURCE_TIMEOUT` (504).
 * The message names the source, so it is shown to Admin IT only.
 */
class ConsoleException extends RuntimeException
{
    /**
     * @param  'SOURCE_UNREACHABLE'|'SOURCE_TIMEOUT'  $errorCode
     * @param  array<string, mixed>  $details
     */
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly ?string $console = null,
        public readonly array $details = [],
    ) {
        parent::__construct($message);
    }

    public function httpStatus(): int
    {
        return $this->errorCode === 'SOURCE_TIMEOUT' ? 504 : 502;
    }

    /**
     * Everyday sentence for accounts that may not see source names.
     */
    public function userMessage(): string
    {
        return $this->errorCode === 'SOURCE_TIMEOUT'
            ? 'Data sedang lambat dimuat. Coba lagi beberapa saat lagi.'
            : 'Data sedang tidak dapat diambil. Coba lagi beberapa saat lagi.';
    }
}
