<?php

use App\Models\Console;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Sleep;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind different classes or traits.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->beforeEach(function () {
        Http::preventStrayRequests();
        Sleep::fake();
    })
    ->in('Feature', 'Unit', 'Stub');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/**
 * Assert a response carries the API error envelope with the given code.
 */
function assertApiError(TestResponse $response, int $status, string $code): void
{
    $response->assertStatus($status)
        ->assertJsonStructure(['error' => ['code', 'message', 'details']])
        ->assertJsonPath('error.code', $code);
}

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

/**
 * Log in as a fresh user of the given role through Sanctum.
 */
function actingAsRole(string $role = 'user'): User
{
    $factory = User::factory();
    $user = ($role === 'admin_it' ? $factory->admin() : $factory)->create();
    Sanctum::actingAs($user);

    return $user;
}

/**
 * Create a user with an explicit custom role and permission code set.
 *
 * @param  list<string>  $permissionCodes
 */
function createUserWithPermissions(string $name, string $roleCode, array $permissionCodes): User
{
    $role = Role::query()->firstOrCreate(['code' => $roleCode], ['name' => ucfirst(str_replace('_', ' ', $roleCode))]);
    $ids = collect($permissionCodes)->map(fn (string $code) => Permission::query()->firstOrCreate(
        ['code' => $code],
        ['description' => Permission::ALL[$code] ?? $code],
    )->id);
    $role->permissions()->sync($ids->all());

    return User::factory()->create([
        'name' => $name,
        'role_id' => $role->id,
    ]);
}

/**
 * The three source APIs behind Http::fake, backed by FakeSources::$rows (contract §1-4: `?ids=`,
 * filters, `status`, `version`/`expected_version`, soft delete). FakeSources::$down lists dead sources.
 */
final class FakeSources
{
    public const HOSTS = ['gudang' => 'items', 'produksi' => 'productions', 'hr' => 'people'];

    /** @var array<string, array<string, array<string, mixed>>> resource => id => row */
    public static array $rows = [];

    /** @var list<string> */
    public static array $down = [];

    /** @var list<string> "METHOD source path?query" */
    public static array $calls = [];

    /**
     * @param  array<string, mixed>  $fields
     * @return array<string, mixed>
     */
    public static function add(string $resource, array $fields): array
    {
        $row = ['id' => (string) Str::uuid(), 'status' => 'aktif', 'version' => 1, 'created_at' => '2026-11-19T00:00:00Z', 'updated_at' => '2026-11-19T00:00:00Z', ...$fields];

        return self::$rows[$resource][$row['id']] = $row;
    }

    /**
     * Calls made to one source, e.g. calls('hr', 'GET').
     *
     * @return list<string>
     */
    public static function calls(string $source, ?string $method = null): array
    {
        return array_values(array_filter(self::$calls, fn ($c) => str_contains($c, " {$source} ") && ($method === null || str_starts_with($c, "{$method} "))));
    }
}

function fakeSources(): void
{
    FakeSources::$rows = ['items' => [], 'productions' => [], 'people' => []];
    FakeSources::$down = [];
    FakeSources::$calls = [];

    foreach (FakeSources::HOSTS as $slug => $resource) {
        Console::query()->where('slug', $slug)->exists() || Console::factory()->create(['slug' => $slug, 'base_url' => "http://{$slug}.test"]);
    }

    Http::fake(function (Request $request) {
        $source = explode('.', parse_url($request->url(), PHP_URL_HOST))[0];
        $path = parse_url($request->url(), PHP_URL_PATH);
        parse_str((string) parse_url($request->url(), PHP_URL_QUERY), $query);
        FakeSources::$calls[] = "{$request->method()} {$source} ".$path.(isset($query['ids']) ? '?ids' : '');

        if (in_array($source, FakeSources::$down, true)) {
            return Http::failedConnection()($request);
        }

        $resource = FakeSources::HOSTS[$source];
        $id = preg_match("#^/api/v1/{$resource}/([^/]+)$#", $path, $m) ? $m[1] : null;
        $rows = &FakeSources::$rows[$resource];
        $error = fn (int $status, string $code, array $details = []) => Http::response(['error' => ['code' => $code, 'message' => $code, 'details' => (object) $details]], $status);

        if ($id === null && $request->method() === 'GET') {
            $ids = isset($query['ids']) ? explode(',', $query['ids']) : null;
            $status = $query['status'] ?? ($ids ? 'all' : 'aktif');
            $found = array_values(array_filter($rows, function ($row) use ($ids, $status, $query) {
                foreach (['kind', 'production_type', 'role', 'production_id', 'responsible_id', 'courier_id'] as $f) {
                    if (isset($query[$f]) && ($row[$f] ?? null) !== $query[$f]) {
                        return false;
                    }
                }

                return ($ids === null || in_array($row['id'], $ids, true)) && ($status === 'all' || $row['status'] === $status);
            }));

            return Http::response(['data' => array_slice($found, 0, (int) ($query['limit'] ?? 25)), 'meta' => ['next_cursor' => null]]);
        }

        if ($id === null) {
            $row = FakeSources::add($resource, $request->data());

            return Http::response(['data' => $row], 201);
        }

        if (! isset($rows[$id])) {
            return $error(404, 'NOT_FOUND');
        }

        if ($request->method() === 'GET') {
            return Http::response(['data' => $rows[$id]]);
        }

        $expected = (int) ($request->method() === 'DELETE' ? ($query['expected_version'] ?? 0) : ($request->data()['expected_version'] ?? 0));

        if ($expected !== $rows[$id]['version']) {
            return $error(409, 'VERSION_CONFLICT', ['current_version' => $rows[$id]['version']]);
        }

        $changes = $request->method() === 'DELETE' ? ['status' => 'nonaktif'] : Arr::except($request->data(), ['expected_version']);
        $rows[$id] = [...$rows[$id], ...$changes, 'version' => $rows[$id]['version'] + 1];

        return Http::response(['data' => $rows[$id]]);
    });
}
