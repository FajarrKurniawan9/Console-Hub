<?php

namespace App\Connectors\Auth;

use App\Models\Console;
use Illuminate\Http\Client\PendingRequest;

class ApiKeyAuth implements AuthStrategy
{
    public function apply(PendingRequest $request, Console $console): PendingRequest
    {
        $credentials = $console->credentials;

        return $request->withHeaders([(string) ($credentials['header'] ?? 'X-API-Key') => (string) ($credentials['key'] ?? '')]);
    }

    public function invalidate(Console $console): bool
    {
        return false;
    }
}
