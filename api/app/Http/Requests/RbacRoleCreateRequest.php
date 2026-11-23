<?php

namespace App\Http\Requests;

use App\Models\Permission;
use Illuminate\Foundation\Http\FormRequest;

class RbacRoleCreateRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:60'],
            'code' => ['required', 'string', 'min:2', 'max:40', 'regex:/^[a-z0-9_-]+$/', 'unique:roles,code'],
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['string', 'in:'.implode(',', array_keys(Permission::ALL))],
        ];
    }
}
