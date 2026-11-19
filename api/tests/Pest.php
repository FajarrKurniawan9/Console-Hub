<?php

use App\Models\Console;
use App\Models\Transaction;
use App\Models\User;
use App\Services\Tx\Coordinator;
use App\Services\Tx\OperationRegistry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
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
    ->in('Feature', 'Unit');

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
        ->assertJsonStructure(['error' => ['code', 'message', 'console', 'fields', 'details']])
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
 * Three consoles behind Http::fake. $script[slug][phase] is a response, a closure, or 'down'/'timeout'.
 * Every call is recorded in ConsoleCalls::$log as "slug phase".
 */
final class ConsoleCalls
{
    /** @var list<string> */
    public static array $log = [];
}

function fakeConsoles(array $script = []): void
{
    ConsoleCalls::$log = [];

    foreach (['hr', 'gudang', 'produksi'] as $slug) {
        Console::query()->where('slug', $slug)->exists() || Console::factory()->create(['slug' => $slug, 'name' => ucfirst($slug), 'base_url' => "http://{$slug}.test", 'service_key' => "key-{$slug}"]);
    }

    Http::fake(function (Request $request) use ($script) {
        $slug = explode('.', parse_url($request->url(), PHP_URL_HOST))[0];
        $path = parse_url($request->url(), PHP_URL_PATH);
        $phase = match (true) {
            str_ends_with($path, '/tx/prepare') => 'prepare',
            str_ends_with($path, '/commit') => 'commit',
            str_ends_with($path, '/abort') => 'abort',
            str_contains($path, '/tx/') => 'status',
            default => 'read',
        };
        ConsoleCalls::$log[] = "{$slug} {$phase}";
        $answer = $script[$slug][$phase] ?? match ($phase) {
            'read' => $script[$slug]['read'] ?? Http::response(['error' => 'not scripted'], 404),
            'prepare' => ['vote' => 'ok'],
            'commit' => ['state' => 'committed'],
            'abort' => ['state' => 'aborted'],
            default => Http::response(['error' => 'not scripted'], 404),
        };

        if ($answer instanceof Closure) {
            $answer = $answer($request);
        }

        return match (true) {
            $answer === 'down' => Http::failedConnection()($request),
            $answer === 'timeout' => Http::failedConnection('cURL error 28: Operation timed out after 8000 milliseconds')($request),
            is_array($answer) => Http::response($answer),
            default => $answer,
        };
    });
}

function runTx(string $operation, array $input, ?string $target = null, ?string $key = null, ?User $user = null): Transaction
{
    return app(Coordinator::class)->run(app(OperationRegistry::class)->get($operation), $input, $target, $user ?? auth()->user(), $key ?? (string) Str::uuid());
}

function calls(string $phase): array
{
    return array_values(array_filter(ConsoleCalls::$log, fn ($c) => str_ends_with($c, " {$phase}")));
}
