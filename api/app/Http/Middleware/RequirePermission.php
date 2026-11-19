<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Support\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * `perm:kode` — 403 FORBIDDEN unless the user's role grants the permission. Several codes = any of them.
 */
class RequirePermission
{
    public function handle(Request $request, Closure $next, string ...$codes): Response
    {
        $user = $request->user();

        if (! $user instanceof User || ! collect($codes)->contains(fn (string $code) => $user->hasPermission($code))) {
            throw new ApiException(403, 'FORBIDDEN', 'Anda tidak memiliki izin untuk tindakan ini.');
        }

        return $next($request);
    }
}
