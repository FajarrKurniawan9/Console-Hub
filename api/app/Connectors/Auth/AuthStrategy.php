<?php

namespace App\Connectors\Auth;

use App\Models\Console;
use Illuminate\Http\Client\PendingRequest;

interface AuthStrategy
{
    public function apply(PendingRequest $request, Console $console): PendingRequest;

    /**
     * Forget any cached session so the next request re-authenticates.
     * Returns true when re-authentication is meaningful (i.e. worth one retry after a 401).
     */
    public function invalidate(Console $console): bool;
}
