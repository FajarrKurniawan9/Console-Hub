<?php

namespace App\Connectors\Auth;

use App\Models\Console;
use Illuminate\Http\Client\PendingRequest;

class BasicAuth implements AuthStrategy
{
    public function apply(PendingRequest $request, Console $console): PendingRequest
    {
        $credentials = $console->credentials;

        return $request->withBasicAuth((string) ($credentials['username'] ?? ''), (string) ($credentials['password'] ?? ''));
    }

    public function invalidate(Console $console): bool
    {
        return false;
    }
}
