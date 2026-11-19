<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class EnsureRequestId
{
    public function handle(Request $request, Closure $next): Response
    {
        $requestId = $request->header('X-Request-Id');
        if (! $requestId || ! is_string($requestId) || trim($requestId) === '') {
            $requestId = (string) Str::uuid();
        }

        $request->headers->set('X-Request-Id', $requestId);
        $request->attributes->set('request_id', $requestId);

        $actingUser = $request->header('X-Acting-User');
        if (is_string($actingUser)) {
            $actingUser = mb_substr(trim($actingUser), 0, 120);
            if ($actingUser === '') {
                $actingUser = null;
            }
        } else {
            $actingUser = null;
        }
        $request->attributes->set('acting_user', $actingUser);

        /** @var Response $response */
        $response = $next($request);

        $response->headers->set('X-Request-Id', $requestId);

        return $response;
    }
}
