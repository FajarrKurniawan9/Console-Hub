<?php

use App\Models\Person;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\Support\SeedUuid;

it('seeds 12 HR people idempotently with deterministic UUIDs', function () {
    $this->seed(DatabaseSeeder::class);

    expect(Person::query()->count())->toBe(12);

    $budi = Person::query()->where('name', 'Budi Santoso')->first();
    expect($budi)->not->toBeNull()
        ->and($budi->id)->toBe(SeedUuid::forPerson('Budi Santoso'))
        ->and($budi->role)->toBe('Kepala Gudang')
        ->and($budi->status)->toBe('aktif')
        ->and($budi->version)->toBe(1);

    $bambang = Person::query()->where('name', 'Bambang Susilo')->first();
    expect($bambang)->not->toBeNull()
        ->and($bambang->id)->toBe(SeedUuid::forPerson('Bambang Susilo'))
        ->and($bambang->role)->toBe('Kurir')
        ->and($bambang->status)->toBe('nonaktif');

    // Run seeder again to verify idempotency
    $this->seed(DatabaseSeeder::class);
    expect(Person::query()->count())->toBe(12);
});
