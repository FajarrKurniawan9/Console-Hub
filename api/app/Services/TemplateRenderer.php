<?php

namespace App\Services;

use App\Services\Exceptions\TemplateException;

/**
 * Renders {{input.x}} and {{steps.N.response.*}} placeholders in step paths and bodies.
 */
class TemplateRenderer
{
    private const PATTERN = '/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/';

    private const MISSING = "\0missing";

    /**
     * Render a JSON-like value. A string that is exactly one placeholder keeps the original type.
     *
     * @param  array<string, mixed>  $context
     */
    public function render(mixed $value, array $context): mixed
    {
        if (is_array($value)) {
            return array_map(fn ($item) => $this->render($item, $context), $value);
        }

        if (! is_string($value)) {
            return $value;
        }

        if (preg_match('/^\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}$/', $value, $match)) {
            return $this->lookup($match[1], $context);
        }

        return preg_replace_callback(self::PATTERN, fn (array $m) => $this->stringify($this->lookup($m[1], $context), $m[1]), $value);
    }

    /**
     * Render a request path: substituted values are URL-encoded and the result must stay relative.
     *
     * @param  array<string, mixed>  $context
     */
    public function renderPath(string $path, array $context): string
    {
        $rendered = (string) preg_replace_callback(
            self::PATTERN,
            fn (array $m) => rawurlencode($this->stringify($this->lookup($m[1], $context), $m[1])),
            $path,
        );

        if (! str_starts_with($rendered, '/') || str_starts_with($rendered, '//') || preg_match('#^[a-z][a-z0-9+.-]*:#i', $rendered)) {
            throw new TemplateException("Path hasil templat harus relatif: {$rendered}");
        }

        return $rendered;
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function lookup(string $expression, array $context): mixed
    {
        $root = explode('.', $expression, 2)[0];

        if (! in_array($root, ['input', 'steps'], true)) {
            throw new TemplateException("Variabel templat {{{$expression}}} tidak diizinkan.");
        }

        $value = data_get($context, $expression, self::MISSING);

        if ($value === self::MISSING) {
            throw new TemplateException("Variabel templat {{{$expression}}} tidak tersedia.");
        }

        return $value;
    }

    private function stringify(mixed $value, string $expression): string
    {
        if (is_array($value) || is_object($value)) {
            throw new TemplateException("Variabel templat {{{$expression}}} bukan nilai tunggal.");
        }

        return match (true) {
            is_bool($value) => $value ? 'true' : 'false',
            $value === null => '',
            default => (string) $value,
        };
    }
}
