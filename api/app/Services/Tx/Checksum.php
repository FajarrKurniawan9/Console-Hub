<?php

namespace App\Services\Tx;

/**
 * sha1 of canonical JSON (keys sorted at every level, no whitespace, unescaped unicode and slashes).
 * Computed by the portal so all three consoles store the same value; consoles that recompute it for
 * the digest must use the same rules (see tools/console-stub).
 */
class Checksum
{
    /** Keys that describe the record, not its business data. */
    public const IGNORED = ['id', 'version', 'checksum', 'locked_by_tx', 'created_at', 'updated_at'];

    /**
     * @param  array<string, mixed>  $entity
     */
    public static function of(array $entity): string
    {
        return sha1(self::canonical(array_diff_key($entity, array_flip(self::IGNORED))));
    }

    public static function canonical(mixed $value): string
    {
        return (string) json_encode(self::sort($value), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    private static function sort(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }

        if (! array_is_list($value)) {
            ksort($value, SORT_STRING);
        }

        return array_map(self::sort(...), $value);
    }
}
