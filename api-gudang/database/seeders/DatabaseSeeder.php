<?php

namespace Database\Seeders;

use Database\Seeders\Support\SeedUuid;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $now = now();

        $items = [
            [
                'name' => 'Kain Katun',
                'kind' => 'kain',
                'production' => ['Area Tekstil A', 'Tenun'],
                'responsible' => 'Budi Santoso',
                'quantity' => 120,
                'unit' => 'roll',
                'status' => 'aktif',
            ],
            [
                'name' => 'Kain Linen',
                'kind' => 'kain',
                'production' => ['Area Tekstil A', 'Tenun'],
                'responsible' => 'Siti Rahmawati',
                'quantity' => 80,
                'unit' => 'roll',
                'status' => 'aktif',
            ],
            [
                'name' => 'Kain Denim Indigo',
                'kind' => 'kain',
                'production' => ['Area Tekstil A', 'Pencelupan'],
                'responsible' => 'Siti Rahmawati',
                'quantity' => 65,
                'unit' => 'roll',
                'status' => 'aktif',
            ],
            [
                'name' => 'Kain Poliester',
                'kind' => 'kain',
                'production' => ['Area Tekstil A', 'Pencelupan'],
                'responsible' => 'Putri Ayu',
                'quantity' => 150,
                'unit' => 'roll',
                'status' => 'aktif',
            ],
            [
                'name' => 'Besi Hollow 4x4',
                'kind' => 'besi',
                'production' => ['Area Logam B', 'Pengecoran'],
                'responsible' => 'Agus Pratama',
                'quantity' => 200,
                'unit' => 'batang',
                'status' => 'aktif',
            ],
            [
                'name' => 'Besi Beton 10mm',
                'kind' => 'besi',
                'production' => ['Area Logam B', 'Pengecoran'],
                'responsible' => 'Agus Pratama',
                'quantity' => 350,
                'unit' => 'batang',
                'status' => 'aktif',
            ],
            [
                'name' => 'Plat Baja 2mm',
                'kind' => 'besi',
                'production' => ['Area Logam B', 'Pengecoran'],
                'responsible' => 'Budi Santoso',
                'quantity' => 90,
                'unit' => 'lembar',
                'status' => 'aktif',
            ],
            [
                'name' => 'Buku Tulis A5',
                'kind' => 'buku',
                'production' => ['Area Percetakan', 'Cetak Offset'],
                'responsible' => 'Dimas Kurniawan',
                'quantity' => 500,
                'unit' => 'pcs',
                'status' => 'aktif',
            ],
            [
                'name' => 'Buku Panduan Logistik',
                'kind' => 'buku',
                'production' => ['Area Percetakan', 'Cetak Offset'],
                'responsible' => 'Dimas Kurniawan',
                'quantity' => 240,
                'unit' => 'pcs',
                'status' => 'aktif',
            ],
            [
                'name' => 'Katalog Produk 2026',
                'kind' => 'buku',
                'production' => ['Area Percetakan', 'Cetak Offset'],
                'responsible' => 'Dewi Lestari',
                'quantity' => 400,
                'unit' => 'pcs',
                'status' => 'aktif',
            ],
            [
                'name' => 'Sarden Kaleng 425g',
                'kind' => 'makanan kaleng',
                'production' => ['Area Pangan', 'Pengalengan'],
                'responsible' => 'Putri Ayu',
                'quantity' => 600,
                'unit' => 'kaleng',
                'status' => 'aktif',
            ],
            [
                'name' => 'Kornet Sapi Kaleng',
                'kind' => 'makanan kaleng',
                'production' => ['Area Pangan', 'Pengalengan'],
                'responsible' => 'Putri Ayu',
                'quantity' => 320,
                'unit' => 'kaleng',
                'status' => 'aktif',
            ],
            [
                'name' => 'Kardus Kemasan Besar',
                'kind' => 'kemasan',
                'production' => null,
                'responsible' => 'Budi Santoso',
                'quantity' => 1000,
                'unit' => 'pcs',
                'status' => 'aktif',
            ],
            [
                'name' => 'Palet Kayu Standar',
                'kind' => 'logistik',
                'production' => null,
                'responsible' => null,
                'quantity' => 45,
                'unit' => 'unit',
                'status' => 'aktif',
            ],
            [
                'name' => 'Besi Siku Lama',
                'kind' => 'besi',
                'production' => ['Area Logam B', 'Pemotongan'],
                'responsible' => null,
                'quantity' => 0,
                'unit' => 'batang',
                'status' => 'nonaktif',
            ],
        ];

        $rows = array_map(function (array $item) use ($now): array {
            $productionId = $item['production'] !== null
                ? SeedUuid::forProduction($item['production'][0], $item['production'][1])
                : null;

            $responsibleId = $item['responsible'] !== null
                ? SeedUuid::forPerson($item['responsible'])
                : null;

            return [
                'id' => SeedUuid::forItem($item['name']),
                'name' => $item['name'],
                'kind' => $item['kind'],
                'production_id' => $productionId,
                'responsible_id' => $responsibleId,
                'quantity' => $item['quantity'],
                'unit' => $item['unit'],
                'status' => $item['status'],
                'version' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }, $items);

        DB::table('items')->upsert(
            $rows,
            ['id'],
            ['name', 'kind', 'production_id', 'responsible_id', 'quantity', 'unit', 'status', 'updated_at']
        );
    }
}
