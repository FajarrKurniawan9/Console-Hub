<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyServiceKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $expectedKey = (string) config('hr.service_key');
        $providedKey = (string) $request->header('X-Service-Key', '');

        if ($providedKey === '' || $expectedKey === '' || ! hash_equals($expectedKey, $providedKey)) {
            throw ApiException::unauthenticated('Kunci layanan tidak valid atau tidak disertakan.');
        }

        return $next($request);
    }
}
