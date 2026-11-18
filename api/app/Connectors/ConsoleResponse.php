<?php

namespace App\Connectors;

use Illuminate\Http\Client\Response;

class ConsoleResponse
{
    public function __construct(
        public readonly int $status,
        public readonly mixed $body,
        public readonly int $latencyMs,
        public readonly string $url,
    ) {}

    public static function from(Response $response, int $latencyMs, string $url): self
    {
        $body = $response->json();

        return new self($response->status(), $body ?? ($response->body() === '' ? null : $response->body()), $latencyMs, $url);
    }

    public function successful(): bool
    {
        return $this->status >= 200 && $this->status < 300;
    }

    public function get(?string $path, mixed $default = null): mixed
    {
        return $path === null || $path === '' ? $this->body : data_get($this->body, $path, $default);
    }
}
