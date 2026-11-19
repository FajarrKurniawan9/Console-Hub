<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Resources\AuthUserResource;
use App\Models\User;
use App\Services\Audit;
use App\Support\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    public function login(LoginRequest $request, Audit $audit): JsonResponse
    {
        $user = User::query()->with('role')->where('email', strtolower($request->string('email')->toString()))->first();

        // Same answer for an unknown email and a wrong password.
        if (! $user || ! Hash::check($request->string('password')->toString(), $user->password)) {
            throw new ApiException(401, 'UNAUTHENTICATED', 'Email atau sandi salah.');
        }

        if (! $user->is_active) {
            throw new ApiException(403, 'FORBIDDEN', 'Akun Anda dinonaktifkan. Hubungi Admin IT untuk mengaktifkannya.');
        }

        $minutes = (int) config('sanctum.expiration');
        $token = $user->createToken('portal', ['*'], $minutes > 0 ? now()->addMinutes($minutes) : null)->plainTextToken;

        $audit->record('auth.login', 'user', (string) $user->id, userId: $user->id);

        return response()->json(['data' => ['token' => $token, 'user' => new AuthUserResource($user)]]);
    }

    public function logout(Request $request): Response
    {
        $token = $request->user()?->currentAccessToken();

        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }

        return response()->noContent();
    }

    public function me(Request $request): AuthUserResource
    {
        /** @var User $user */
        $user = $request->user();

        return new AuthUserResource($user->load('role'));
    }
}
