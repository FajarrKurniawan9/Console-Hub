<?php

use App\Models\AuditEvent;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Database\Factories\UserFactory;
use Illuminate\Support\Facades\Route;

/** Every admin route with the permission that guards it. */
dataset('admin routes', [
    ['GET', '/api/v1/admin/overview'],
    ['GET', '/api/v1/admin/consoles'],
    ['GET', '/api/v1/admin/consoles/1'],
    ['POST', '/api/v1/admin/consoles/1/test'],
    ['POST', '/api/v1/admin/consoles'],
    ['PATCH', '/api/v1/admin/consoles/1'],
    ['DELETE', '/api/v1/admin/consoles/1'],
    ['GET', '/api/v1/admin/logs'],
    ['GET', '/api/v1/admin/logs/1'],
    ['POST', '/api/v1/admin/logs/sync'],
    ['GET', '/api/v1/admin/rbac/users'],
    ['POST', '/api/v1/admin/rbac/users'],
    ['PATCH', '/api/v1/admin/rbac/users/1'],
    ['GET', '/api/v1/admin/rbac/roles'],
    ['POST', '/api/v1/admin/rbac/roles'],
    ['DELETE', '/api/v1/admin/rbac/roles/1'],
    ['GET', '/api/v1/admin/rbac/permissions'],
    ['PUT', '/api/v1/admin/rbac/roles/1/permissions'],
    ['GET', '/api/v1/admin/audit'],
]);

it('forbids every admin route to the user role', function (string $method, string $uri) {
    actingAsRole('user');

    assertApiError($this->json($method, $uri), 403, 'FORBIDDEN');
})->with('admin routes');

it('requires a login on every admin route', function (string $method, string $uri) {
    assertApiError($this->json($method, $uri), 401, 'UNAUTHENTICATED');
})->with('admin routes');

it('guards every api route except login with a permission', function () {
    $open = [
        'api/v1/auth/login',
        'api/v1/auth/request-otp',
        'api/v1/auth/verify-otp',
        'api/v1/auth/google/redirect',
        'api/v1/auth/google/callback',
        'api/v1/auth/google/exchange',
        'api/v1/auth/logout',
        'api/v1/auth/me',
    ];

    $unguarded = collect(Route::getRoutes()->getRoutes())
        ->filter(fn ($r) => str_starts_with($r->uri(), 'api/v1/') && ! in_array($r->uri(), $open, true))
        ->reject(fn ($r) => collect($r->gatherMiddleware())->contains(fn ($m) => is_string($m) && str_starts_with($m, 'perm:')))
        ->map(fn ($r) => $r->uri())
        ->values()->all();

    expect($unguarded)->toBe([]);
});

it('follows permission changes of the role immediately', function () {
    $user = actingAsRole('user');
    $role = $user->role;
    $role->permissions()->attach(Permission::query()->firstOrCreate(['code' => 'admin.audit.view'])->id);

    $this->getJson('/api/v1/admin/audit')->assertOk();
});

it('lists users, roles and every permission', function () {
    $admin = actingAsRole('admin_it');
    User::factory()->create(['name' => 'Budi']);

    $this->getJson('/api/v1/admin/rbac/users')->assertOk()
        ->assertJsonStructure(['data' => [['id', 'name', 'email', 'role' => ['code', 'name'], 'is_active']], 'meta' => ['next_cursor', 'total']])
        ->assertJsonCount(2, 'data');
    $this->getJson('/api/v1/admin/rbac/roles')->assertOk()
        ->assertJsonStructure(['data' => [['id', 'code', 'name', 'permissions']], 'meta'])
        ->assertJsonPath('data.0.code', 'admin_it');
    $this->getJson('/api/v1/admin/rbac/permissions')->assertOk()
        ->assertJsonCount(count(Permission::ALL), 'data');
    expect($admin)->not->toBeNull();
});

it('creates a user with a one time initial password and audits it', function () {
    actingAsRole('admin_it');
    UserFactory::role(Role::USER);

    $response = $this->postJson('/api/v1/admin/rbac/users', ['name' => 'Sari Dewi', 'email' => 'Sari@Example.com', 'role_code' => 'user'])
        ->assertCreated()
        ->assertJsonPath('data.email', 'sari@example.com')
        ->assertJsonPath('data.role.code', 'user')
        ->assertJsonPath('data.is_active', true);

    $password = $response->json('data.initial_password');
    expect($password)->toBeString()->toHaveLength(16);

    $this->postJson('/api/v1/auth/login', ['email' => 'sari@example.com', 'password' => $password])->assertOk();
    $audit = AuditEvent::query()->where('action', 'rbac.user_created')->sole();
    expect($audit->new_value)->toEqualCanonicalizing(['email' => 'sari@example.com', 'role' => 'user'])
        ->and(json_encode($audit->new_value))->not->toContain($password);
});

it('validates new users', function () {
    actingAsRole('admin_it');
    User::factory()->create(['email' => 'ada@example.com']);

    $response = $this->postJson('/api/v1/admin/rbac/users', ['name' => 'Al', 'email' => 'ada@example.com', 'role_code' => 'tidak-ada']);

    assertApiError($response, 422, 'VALIDATION_ERROR');
    $response->assertJsonPath('error.details.fields.email.0', 'Email ini sudah dipakai pengguna lain.')
        ->assertJsonStructure(['error' => ['details' => ['fields' => ['name', 'role_code']]]]);
});

it('changes role and active flag with old and new values in the audit', function () {
    actingAsRole('admin_it');
    $user = User::factory()->create();
    $token = $user->createToken('t')->plainTextToken;

    $this->patchJson("/api/v1/admin/rbac/users/{$user->id}", ['role_code' => 'admin_it', 'is_active' => false])
        ->assertOk()
        ->assertJsonPath('data.role.code', 'admin_it')
        ->assertJsonPath('data.is_active', false);

    $audit = AuditEvent::query()->where('action', 'rbac.user_updated')->sole();
    expect($audit->old_value)->toBe(['role' => 'user', 'is_active' => true])
        ->and($audit->new_value)->toBe(['role' => 'admin_it', 'is_active' => false])
        ->and($user->tokens()->count())->toBe(0);
    expect($token)->toBeString();
});

it('does not let an admin deactivate themself or drop their own rbac access', function () {
    $admin = actingAsRole('admin_it');
    UserFactory::role(Role::USER);

    assertApiError($this->patchJson("/api/v1/admin/rbac/users/{$admin->id}", ['is_active' => false]), 409, 'CONFLICT');
    assertApiError($this->patchJson("/api/v1/admin/rbac/users/{$admin->id}", ['role_code' => 'user']), 409, 'CONFLICT');
    expect($admin->refresh()->is_active)->toBeTrue()->and($admin->role->code)->toBe('admin_it');
});

it('replaces the permissions of a role and audits what was added and removed', function () {
    actingAsRole('admin_it');
    $role = UserFactory::role(Role::USER);

    $this->putJson("/api/v1/admin/rbac/roles/{$role->id}/permissions", ['permissions' => ['personel.view', 'admin.audit.view']])
        ->assertOk()
        ->assertJsonPath('data.permissions', ['admin.audit.view', 'personel.view']);

    $audit = AuditEvent::query()->where('action', 'rbac.role_updated')->sole();
    expect($audit->new_value['ditambah'])->toBe(['admin.audit.view'])
        ->and($audit->new_value['dicabut'])->toContain('barang.create')
        ->and($audit->old_value['permissions'])->toContain('barang.create');
});

it('keeps admin.rbac.manage on admin_it and rejects unknown permissions', function () {
    $admin = actingAsRole('admin_it');

    assertApiError($this->putJson("/api/v1/admin/rbac/roles/{$admin->role_id}/permissions", ['permissions' => ['admin.audit.view']]), 409, 'CONFLICT');
    assertApiError($this->putJson("/api/v1/admin/rbac/roles/{$admin->role_id}/permissions", ['permissions' => ['admin.rbac.manage', 'tidak.ada']]), 422, 'VALIDATION_ERROR');
    expect($admin->role->permissions()->count())->toBe(count(Permission::ALL));
});

it('creates a custom role dynamically and audits it', function () {
    actingAsRole('admin_it');

    $response = $this->postJson('/api/v1/admin/rbac/roles', [
        'name' => 'Koordinator Lapangan',
        'code' => 'koordinator_lapangan',
        'permissions' => ['barang.view', 'produksi.view'],
    ])->assertCreated()
        ->assertJsonPath('data.name', 'Koordinator Lapangan')
        ->assertJsonPath('data.code', 'koordinator_lapangan')
        ->assertJsonPath('data.permissions', ['barang.view', 'produksi.view']);

    $roleId = $response->json('data.id');
    $audit = AuditEvent::query()->where('action', 'rbac.role_created')->sole();
    expect($audit->new_value)->toEqualCanonicalizing(['name' => 'Koordinator Lapangan', 'code' => 'koordinator_lapangan']);

    // Can delete custom role without users
    $this->deleteJson("/api/v1/admin/rbac/roles/{$roleId}")->assertNoContent();
    expect(Role::query()->find($roleId))->toBeNull();
});

it('protects system roles from deletion', function () {
    actingAsRole('admin_it');
    $adminRole = Role::query()->where('code', Role::ADMIN_IT)->first();

    assertApiError($this->deleteJson("/api/v1/admin/rbac/roles/{$adminRole->id}"), 409, 'CONFLICT');
});
