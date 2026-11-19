<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApiException extends Exception
{
    /**
     * @param  array<string, mixed>|null  $details
     */
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly int $status = 400,
        public readonly ?array $details = null,
    ) {
        parent::__construct($message, $status);
    }

    public static function unauthenticated(string $message = 'Kunci layanan tidak valid atau tidak disertakan.'): self
    {
        return new self('UNAUTHENTICATED', $message, 401);
    }

    public static function notFound(string $message = 'Personel tidak ditemukan.'): self
    {
        return new self('NOT_FOUND', $message, 404);
    }

    public static function versionConflict(int $currentVersion, string $message = 'Versi data tidak cocok.'): self
    {
        return new self('VERSION_CONFLICT', $message, 409, ['current_version' => $currentVersion]);
    }

    public static function duplicate(string $message = 'Data personel sudah ada.'): self
    {
        return new self('DUPLICATE', $message, 409);
    }

    /**
     * @param  array<string, list<string>>  $fields
     */
    public static function validation(array $fields, string $message = 'Data yang dikirim tidak valid.'): self
    {
        return new self('VALIDATION_ERROR', $message, 422, ['fields' => $fields]);
    }

    public static function rateLimited(string $message = 'Terlalu banyak permintaan. Silakan coba beberapa saat lagi.'): self
    {
        return new self('RATE_LIMITED', $message, 429);
    }

    public static function serverError(string $message = 'Terjadi kesalahan internal pada server.'): self
    {
        return new self('SERVER_ERROR', $message, 500);
    }

    public function render(Request $request): JsonResponse
    {
        $payload = [
            'error' => [
                'code' => $this->errorCode,
                'message' => $this->getMessage(),
                'details' => (object) ($this->details ?? []),
            ],
        ];

        $response = response()->json($payload, $this->status);

        $requestId = $request->header('X-Request-Id');
        if ($requestId) {
            $response->header('X-Request-Id', $requestId);
        }

        return $response;
    }
}
