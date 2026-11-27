<?php

namespace App\Connectors;

use Illuminate\Http\Client\Response;

class ConsoleResponse
{
    /**
     * @param  array<string, string>  $headers  Lowercase header name => header value
     */
    public function __construct(
        public readonly int $status,
        public readonly mixed $body,
        public readonly int $latencyMs,
        public readonly string $url,
        public readonly array $headers = [],
    ) {}

    public static function from(Response $response, int $latencyMs, string $url): self
    {
        $body = $response->json();
        $headers = [];

        foreach ($response->headers() as $name => $values) {
            if (is_string($name) && is_array($values) && $values !== []) {
                $headers[strtolower($name)] = (string) reset($values);
            }
        }

        return new self($response->status(), $body ?? ($response->body() === '' ? null : $response->body()), $latencyMs, $url, $headers);
    }

    public function successful(): bool
    {
        return $this->status >= 200 && $this->status < 300;
    }

    public function get(?string $path, mixed $default = null): mixed
    {
        return $path === null || $path === '' ? $this->body : data_get($this->body, $path, $default);
    }

    public function header(string $name): ?string
    {
        return $this->headers[strtolower($name)] ?? null;
    }
}
