<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Frontend `RbacUser`.
 *
 * @mixin User
 */
class RbacUserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => ['code' => $this->role->code, 'name' => $this->role->name],
            'is_active' => $this->is_active,
        ];
    }
}
