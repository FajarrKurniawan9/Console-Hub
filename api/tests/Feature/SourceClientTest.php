<?php

use App\Connectors\Exceptions\ConsoleException;
use App\Models\Console;
use App\Services\Sources\SourceRegistry;
use App\Support\ApiException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

function sources(): SourceRegistry
{
    foreach (['hr', 'gudang', 'produksi'] as $slug) {
        Console::query()->where('slug', $slug)->exists() || Console::factory()->create(['slug' => $slug, 'base_url' => "http://{$slug}.test"]);
    }

    return app(SourceRegistry::class);
}

it('maps each resource to its owner source', function () {
    $registry = sources();

    expect($registry->items()->source)->toBe('gudang')
        ->and($registry->productions()->source)->toBe('produksi')
        ->and($registry->people()->source)->toBe('hr');
});

it('reads one record, a missing one, and a dead source', function () {
    Http::fake([
        'hr.test/api/v1/people/p1' => Http::response(['data' => ['id' => 'p1', 'name' => 'Sari']]),
        'hr.test/api/v1/people/p2' => Http::response(['error' => ['code' => 'NOT_FOUND']], 404),
        'gudang.test/*' => Http::failedConnection(),
    ]);
    $registry = sources();

    expect($registry->people()->find('p1'))->status->toBe('ok')->data->toBe(['id' => 'p1', 'name' => 'Sari'])
        ->and($registry->people()->find('p2')->status)->toBe('not_found')
        ->and($registry->items()->find('i1'))->status->toBe('unavailable')->error->errorCode->toBe('SOURCE_UNREACHABLE');
});

it('reports a source missing from the registry as unavailable without calling anyone', function () {
    $result = app(SourceRegistry::class)->people()->find('p1');

    expect($result->status)->toBe('unavailable')->and(fn () => $result->orFail())->toThrow(ConsoleException::class);
    Http::assertNothingSent();
});

it('runs GETs on several sources in parallel, one dead source does not hide the others', function () {
    $produksiCalls = 0;
    Http::fake([
        'hr.test/*' => Http::response(['data' => [['id' => 'p1']], 'meta' => ['next_cursor' => null]]),
        'produksi.test/*' => function (Request $request) use (&$produksiCalls) {
            $produksiCalls++;

            return Http::failedConnection()($request);
        },
    ]);
    $registry = sources();

    $results = $registry->getMany([
        'people' => [$registry->people(), $registry->people()->idsPath(['p1']), false],
        'productions' => [$registry->productions(), $registry->productions()->idsPath(['x1']), false],
    ]);

    expect($results['people']->data)->toBe(['data' => [['id' => 'p1']], 'next_cursor' => null])
        ->and($results['productions']->unavailable())->toBeTrue();
    Http::assertSent(fn (Request $r) => $r->url() === 'http://hr.test/api/v1/people?ids=p1&status=all&limit=100');
    expect($produksiCalls)->toBe(2); // one retry after a connection error
});

it('passes VERSION_CONFLICT and validation errors from the owner through', function () {
    Http::fake([
        'hr.test/api/v1/people/p1' => Http::response(['error' => ['code' => 'VERSION_CONFLICT', 'message' => 'x', 'details' => ['current_version' => 3]]], 409),
        'hr.test/api/v1/people' => Http::response(['error' => ['code' => 'VALIDATION_ERROR', 'message' => 'x', 'details' => ['fields' => ['name' => ['Terlalu pendek.']]]]], 422),
    ]);
    $people = sources()->people();

    expect(fn () => $people->write('PATCH', 'p1', ['name' => 'A', 'expected_version' => 2]))
        ->toThrow(fn (ApiException $e) => expect([$e->status, $e->errorCode, $e->details])->toBe([409, 'VERSION_CONFLICT', ['current_version' => 3]]));
    expect(fn () => $people->write('POST', null, ['name' => 'A']))
        ->toThrow(fn (ApiException $e) => expect($e->details)->toBe(['fields' => ['name' => ['Terlalu pendek.']]]));
});

it('sends DELETE with expected_version in the query string', function () {
    Http::fake(['hr.test/*' => Http::response(['data' => ['id' => 'p1', 'status' => 'nonaktif']])]);

    sources()->people()->write('DELETE', 'p1', query: ['expected_version' => 4]);

    Http::assertSent(fn (Request $r) => $r->method() === 'DELETE' && $r->url() === 'http://hr.test/api/v1/people/p1?expected_version=4' && $r->hasHeader('X-Service-Key'));
});
