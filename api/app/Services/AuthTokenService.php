<?php

namespace App\Services;

use App\Models\User;

class AuthTokenService
{
    public function __construct(private Audit $audit) {}

    /**
     * Issue a Sanctum token, record the login audit event, and return the standard login payload.
     *
     * @return array{
     *     data: array{
     *         token: string,
     *         user: array{
     *             id: int,
     *             name: string,
     *             email: string,
     *             role: array{code: string, name: string},
     *             permissions: list<string>
     *         }
     *     }
     * }
     */
    public function issue(User $user, string $method = 'password'): array
    {
        $user->loadMissing('role');

        $minutes = (int) config('sanctum.expiration');
        $token = $user->createToken(
            'portal',
            ['*'],
            $minutes > 0 ? now()->addMinutes($minutes) : null,
        )->plainTextToken;

        $this->audit->record(
            'auth.login',
            'user',
            (string) $user->id,
            new: ['method' => $method],
            userId: $user->id,
        );

        return [
            'data' => [
                'token' => $token,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => [
                        'code' => $user->role->code,
                        'name' => $user->role->name,
                    ],
                    'permissions' => $user->permissionCodes(),
                ],
            ],
        ];
    }
}
