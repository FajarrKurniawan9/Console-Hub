<?php

namespace Tests\Unit;

use Database\Seeders\Support\SeedUuid;
use PHPUnit\Framework\TestCase;

class SeedUuidTest extends TestCase
{
    public function test_generates_deterministic_uuids_matching_cross_service_contracts(): void
    {
        $this->assertSame('8677fbf8-f1d5-5b65-878b-f8c0e1f962ee', SeedUuid::forPerson('Budi Santoso'));
        $this->assertSame('23074973-e276-5dd6-a038-bc3c2c614e80', SeedUuid::forProduction('Area Tekstil A', 'Tenun'));
        $this->assertSame('bd60bcc4-27e4-5353-b2f3-17756591d2f0', SeedUuid::forItem('Kain Katun'));
    }
}
