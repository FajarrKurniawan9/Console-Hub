<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * POST (create: name, email, role_code) and PATCH (role_code?, is_active?) of an RBAC user.
 */
class RbacUserRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $creating = ! $this->route('user') instanceof User;

        return [
            'name' => [$creating ? 'required' : 'prohibited', 'string', 'min:3', 'max:100'],
            'email' => [$creating ? 'required' : 'prohibited', 'email', 'max:150', Rule::unique('users', 'email')],
            'role_code' => [$creating ? 'required' : 'sometimes', 'string', Rule::exists('roles', 'code')],
            'is_active' => [$creating ? 'prohibited' : 'sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Nama wajib diisi, minimal 3 huruf.',
            'name.min' => 'Nama wajib diisi, minimal 3 huruf.',
            'email.email' => 'Format email tidak valid.',
            'email.unique' => 'Email ini sudah dipakai pengguna lain.',
            'role_code.required' => 'Pilih peran.',
            'role_code.exists' => 'Pilih peran.',
        ];
    }
}
