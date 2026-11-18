<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ApiResponse
{
    /**
     * Build the single error envelope used by every API failure.
     *
     * @param  array<string, list<string>>  $fields
     * @param  array<string, mixed>  $details
     */
    public static function error(int $status, string $code, string $message, ?string $console = null, array $fields = [], array $details = []): JsonResponse
    {
        return new JsonResponse([
            'error' => [
                'code' => $code,
                'message' => $message,
                'console' => $console,
                'fields' => (object) $fields,
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
}
