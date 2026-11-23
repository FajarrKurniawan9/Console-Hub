<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\RbacRoleCreateRequest;
use App\Http\Requests\RbacRolePermissionsRequest;
use App\Http\Requests\RbacUserRequest;
use App\Http\Resources\RbacRoleResource;
use App\Http\Resources\RbacUserResource;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\Audit;
use App\Support\ApiException;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RbacController extends Controller
{
    public function __construct(private Audit $audit) {}

    public function users(): JsonResponse
    {
        $users = User::query()->with('role')->orderBy('name')->get();

        return ApiResponse::list(RbacUserResource::collection($users), null, $users->count());
    }

    public function storeUser(RbacUserRequest $request): JsonResponse
    {
        $role = Role::query()->where('code', $request->validated('role_code'))->firstOrFail();
        // Random first password, shown once to the admin who created the account.
        $password = Str::password(16, symbols: false);

        $user = User::query()->create([
            'name' => $request->validated('name'),
            'email' => strtolower((string) $request->validated('email')),
            'password' => $password,
            'role_id' => $role->id,
            'is_active' => true,
        ]);

        $this->audit->record('rbac.user_created', 'user', (string) $user->id, null, ['email' => $user->email, 'role' => $role->code]);

        return response()->json(['data' => [...(new RbacUserResource($user->load('role')))->resolve(), 'initial_password' => $password]], 201);
    }

    public function updateUser(RbacUserRequest $request, User $user): RbacUserResource
    {
        $actor = $request->user();
        $user->load('role');
        $old = ['role' => $user->role->code, 'is_active' => $user->is_active];

        if ($request->has('role_code')) {
            $role = Role::query()->with('permissions')->where('code', $request->validated('role_code'))->firstOrFail();

            if ($user->is($actor) && ! $role->permissions->contains('code', 'admin.rbac.manage')) {
                throw ApiException::conflict('Anda tidak dapat mencabut akses RBAC dari akun Anda sendiri.');
            }

            $user->role_id = $role->id;
        }

        if ($request->has('is_active')) {
            if ($user->is($actor) && ! $request->boolean('is_active')) {
                throw ApiException::conflict('Anda tidak dapat menonaktifkan akun Anda sendiri.');
            }

            $user->is_active = $request->boolean('is_active');
        }

        $user->save();

        if (! $user->is_active) {
            $user->tokens()->delete();
        }

        $user->load('role');
        $this->audit->record('rbac.user_updated', 'user', (string) $user->id, $old, ['role' => $user->role->code, 'is_active' => $user->is_active]);

        return new RbacUserResource($user);
    }

    public function roles(): JsonResponse
    {
        $roles = Role::query()->with('permissions')->orderBy('id')->get();

        return ApiResponse::list(RbacRoleResource::collection($roles), null, $roles->count());
    }

    public function storeRole(RbacRoleCreateRequest $request): JsonResponse
    {
        $role = DB::transaction(function () use ($request) {
            $role = Role::query()->create([
                'name' => $request->validated('name'),
                'code' => strtolower((string) $request->validated('code')),
            ]);

            if ($request->has('permissions')) {
                $codes = array_values(array_unique($request->validated('permissions', [])));
                $role->permissions()->sync(Permission::query()->whereIn('code', $codes)->pluck('id')->all());
            }

            return $role;
        });

        $this->audit->record('rbac.role_created', 'role', $role->code, null, [
            'name' => $role->name,
            'code' => $role->code,
        ]);

        return (new RbacRoleResource($role->load('permissions')))->response()->setStatusCode(201);
    }

    public function destroyRole(Role $role): Response
    {
        if (in_array($role->code, [Role::ADMIN_IT, Role::USER], true)) {
            throw ApiException::conflict('Peran bawaan sistem tidak boleh dihapus.');
        }

        if ($role->users()->exists()) {
            throw ApiException::conflict('Peran masih digunakan oleh pengguna aktif.');
        }

        $this->audit->record('rbac.role_deleted', 'role', $role->code, [
            'name' => $role->name,
            'code' => $role->code,
        ]);

        $role->delete();

        return response()->noContent();
    }

    public function permissions(): JsonResponse
    {
        $codes = Permission::query()->orderBy('id')->pluck('code');

        return ApiResponse::list($codes->all(), null, $codes->count());
    }

    public function updateRolePermissions(RbacRolePermissionsRequest $request, Role $role): RbacRoleResource
    {
        /** @var list<string> $codes */
        $codes = array_values(array_unique($request->validated('permissions')));

        if ($role->code === Role::ADMIN_IT && ! in_array('admin.rbac.manage', $codes, true)) {
            throw ApiException::conflict('Peran Admin IT tidak boleh kehilangan izin admin.rbac.manage; tidak ada yang dapat mengatur izin lagi.');
        }

        $old = $role->permissions()->pluck('code')->sort()->values()->all();

        DB::transaction(fn () => $role->permissions()->sync(Permission::query()->whereIn('code', $codes)->pluck('id')->all()));

        $new = $role->permissions()->pluck('code')->sort()->values()->all();
        $this->audit->record('rbac.role_updated', 'role', $role->code, ['permissions' => $old], [
            'permissions' => $new,
            'ditambah' => array_values(array_diff($new, $old)),
            'dicabut' => array_values(array_diff($old, $new)),
        ]);

        return new RbacRoleResource($role->load('permissions'));
    }
}
