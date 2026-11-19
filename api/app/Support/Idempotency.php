<?php

namespace App\Support;

use App\Services\Tx\Checksum;
use Illuminate\Http\Request;

/**
 * `Idempotency-Key` handling for writes: same key + same request = same transaction.
 */
class Idempotency
{
    public static function key(Request $request): string
    {
        $key = (string) $request->headers->get('Idempotency-Key', '');

        if (! preg_match('/^[A-Za-z0-9-]{8,64}$/', $key)) {
            throw ApiException::validation(['idempotency_key' => ['Header Idempotency-Key wajib diisi (UUID).']]);
        }

        return $key;
    }

    /**
     * Fingerprint of what the user asked for; a reused key with a different fingerprint is refused.
     *
     * @param  array<string, mixed>  $input
     */
    public static function hash(string $operation, ?string $targetId, array $input): string
    {
        return sha1($operation.'|'.($targetId ?? '').'|'.Checksum::canonical($input));
    }
}
