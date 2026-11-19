<?php

namespace Tests\Feature;

use App\Models\Item;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\Support\SeedUuid;
use Tests\TestCase;

class SeederTest extends TestCase
{
    public function test_seeds_15_items_idempotently_with_deterministic_uuids(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(15, Item::query()->count());

        $kainKatun = Item::query()->where('name', 'Kain Katun')->first();
        $this->assertNotNull($kainKatun);
        $this->assertSame(SeedUuid::forItem('Kain Katun'), $kainKatun->id);
        $this->assertSame('kain', $kainKatun->kind);
        $this->assertSame(SeedUuid::forProduction('Area Tekstil A', 'Tenun'), $kainKatun->production_id);
        $this->assertSame(SeedUuid::forPerson('Budi Santoso'), $kainKatun->responsible_id);
        $this->assertSame(120, $kainKatun->quantity);
        $this->assertSame('roll', $kainKatun->unit);
        $this->assertSame('aktif', $kainKatun->status);
        $this->assertSame(1, $kainKatun->version);

        $palet = Item::query()->where('name', 'Palet Kayu Standar')->first();
        $this->assertNotNull($palet);
        $this->assertNull($palet->production_id);
        $this->assertNull($palet->responsible_id);
        $this->assertSame('aktif', $palet->status);

        $besiLama = Item::query()->where('name', 'Besi Siku Lama')->first();
        $this->assertNotNull($besiLama);
        $this->assertSame('nonaktif', $besiLama->status);
        $this->assertSame(0, $besiLama->quantity);
        $this->assertNull($besiLama->responsible_id);
        $this->assertSame(SeedUuid::forProduction('Area Logam B', 'Pemotongan'), $besiLama->production_id);

        // Run seeder again to verify idempotency
        $this->seed(DatabaseSeeder::class);
        $this->assertSame(15, Item::query()->count());
    }
}
