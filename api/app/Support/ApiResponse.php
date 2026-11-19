<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ApiResponse
{
    /**
     * Build the single error envelope used by every API failure.
     *
     * @param  array<string, mixed>  $details
     */
    public static function error(int $status, string $code, string $message, array $details = []): JsonResponse
    {
        return new JsonResponse([
            'error' => [
                'code' => $code,
                'message' => $message,
                'details' => (object) $details,
            ],
        ], $status);
    }

    /**
     * @param  array<int, mixed>|AnonymousResourceCollection  $data
     */
    public static function list(mixed $data, ?string $nextCursor = null, ?int $total = null): JsonResponse
    {
        return new JsonResponse([
            'data' => $data,
            'meta' => ['next_cursor' => $nextCursor, 'total' => $total],
        ]);
    }

    /**
     * A list merged from source APIs; `unavailable` names the sources that were down.
     *
     * @param  array<int, mixed>|AnonymousResourceCollection  $data
     * @param  list<string>  $unavailable
     */
    public static function merged(mixed $data, ?string $nextCursor, array $unavailable): JsonResponse
    {
        return new JsonResponse([
            'data' => $data,
            'meta' => array_filter(['next_cursor' => $nextCursor, 'unavailable' => $unavailable], fn ($v, $k) => $k === 'next_cursor' || $v !== [], ARRAY_FILTER_USE_BOTH),
        ]);
    }
}
