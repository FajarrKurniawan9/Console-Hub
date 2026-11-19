<?php

use Database\Seeders\Support\SeedUuid;

it('generates deterministic UUIDs matching cross-service contracts', function () {
    expect(SeedUuid::forPerson('Budi Santoso'))->toBe('8677fbf8-f1d5-5b65-878b-f8c0e1f962ee')
        ->and(SeedUuid::forProduction('Area Tekstil A', 'Tenun'))->toBe('23074973-e276-5dd6-a038-bc3c2c614e80')
        ->and(SeedUuid::forItem('Kain Katun'))->toBe('bd60bcc4-27e4-5353-b2f3-17756591d2f0');
});
