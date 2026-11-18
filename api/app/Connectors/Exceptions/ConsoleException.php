<?php

namespace App\Connectors\Exceptions;

use RuntimeException;

class ConsoleException extends RuntimeException
{
    /**
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
        return $this->errorCode === 'CONSOLE_TIMEOUT' ? 504 : 502;
    }
}
