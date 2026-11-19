<?php

use App\Console\Commands\HubSeedDemo;
use App\Models\AuditEvent;
use Ramsey\Uuid\Uuid;

beforeEach(fn () => fakeSources());

it('uses the deterministic uuid v5 ids agreed in the contract', function () {
    expect(HubSeedDemo::personId('Rina Wulandari'))->toBe(Uuid::uuid5(HubSeedDemo::NAMESPACE, 'person:rina-wulandari')->toString())
        ->and(HubSeedDemo::productionId('Area Tekstil A', 'Tenun'))->toBe(Uuid::uuid5(HubSeedDemo::NAMESPACE, 'production:area-tekstil-a:tenun')->toString());
});

it('seeds people, productions and items through the hub write flow, and is idempotent', function () {
    $this->artisan('hub:seed-demo')->assertSuccessful();

    expect(FakeSources::$rows['people'])->toHaveCount(12)
        ->and(FakeSources::$rows['productions'])->toHaveCount(6)
        ->and(FakeSources::$rows['items'])->toHaveCount(15)
        ->and(collect(FakeSources::$rows['people'])->where('status', 'nonaktif'))->toHaveCount(1)
        ->and(FakeSources::$rows['items'][HubSeedDemo::itemId('Kain katun')]['production_id'])->toBe(HubSeedDemo::productionId('Area Tekstil A', 'Tenun'))
        ->and(AuditEvent::query()->where('action', 'item.created')->count())->toBe(15);

    $posts = count(array_filter(FakeSources::$calls, fn ($c) => str_starts_with($c, 'POST')));
    $this->artisan('hub:seed-demo')->assertSuccessful()->expectsOutputToContain('dilewati');
    expect(count(array_filter(FakeSources::$calls, fn ($c) => str_starts_with($c, 'POST'))))->toBe($posts);
});

it('writes nothing on --dry-run and honours --only', function () {
    $this->artisan('hub:seed-demo --dry-run')->assertSuccessful();
    $this->artisan('hub:seed-demo --only=people')->assertSuccessful();

    expect(FakeSources::$rows['people'])->toHaveCount(12)->and(FakeSources::$rows['items'])->toBe([]);
});

it('counts items as refused when their references are missing', function () {
    $this->artisan('hub:seed-demo --only=items')->assertFailed()->expectsOutputToContain('ditolak');

    expect(collect(FakeSources::$rows['items'])->pluck('name')->all())->toBe(['Lakban cokelat']);
});
