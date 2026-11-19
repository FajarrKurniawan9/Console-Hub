<?php

namespace Tests\Feature;

use App\Models\Production;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\Support\SeedUuid;
use Tests\TestCase;

class SeederTest extends TestCase
{
    public function test_seeds_6_productions_idempotently_with_deterministic_uuids(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(6, Production::query()->count());

        $tenun = Production::query()
            ->where('area', 'Area Tekstil A')
            ->where('production_type', 'Tenun')
            ->first();

        $this->assertNotNull($tenun);
        $this->assertSame(SeedUuid::forProduction('Area Tekstil A', 'Tenun'), $tenun->id);
        $this->assertSame(SeedUuid::forPerson('Rizky Hidayat'), $tenun->courier_id);
        $this->assertSame('aktif', $tenun->status);
        $this->assertSame(1, $tenun->version);

        $pencelupan = Production::query()
            ->where('area', 'Area Tekstil A')
            ->where('production_type', 'Pencelupan')
            ->first();

        $this->assertNotNull($pencelupan);
        $this->assertNull($pencelupan->courier_id);
        $this->assertSame('aktif', $pencelupan->status);

        $pemotongan = Production::query()
            ->where('area', 'Area Logam B')
            ->where('production_type', 'Pemotongan')
            ->first();

        $this->assertNotNull($pemotongan);
        $this->assertSame('nonaktif', $pemotongan->status);

        // Run seeder again to verify idempotency
        $this->seed(DatabaseSeeder::class);
        $this->assertSame(6, Production::query()->count());
    }
}
