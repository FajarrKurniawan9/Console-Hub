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

        $productions = [
            [
                'area' => 'Area Tekstil A',
                'production_type' => 'Tenun',
                'courier' => 'Rizky Hidayat',
                'status' => 'aktif',
            ],
            [
                'area' => 'Area Logam B',
                'production_type' => 'Pengecoran',
                'courier' => 'Hendra Wijaya',
                'status' => 'aktif',
            ],
            [
                'area' => 'Area Percetakan',
                'production_type' => 'Cetak Offset',
                'courier' => 'Fajar Nugroho',
                'status' => 'aktif',
            ],
            [
                'area' => 'Area Pangan',
                'production_type' => 'Pengalengan',
                'courier' => 'Rizky Hidayat',
                'status' => 'aktif',
            ],
            [
                'area' => 'Area Tekstil A',
                'production_type' => 'Pencelupan',
                'courier' => null,
                'status' => 'aktif',
            ],
            [
                'area' => 'Area Logam B',
                'production_type' => 'Pemotongan',
                'courier' => 'Hendra Wijaya',
                'status' => 'nonaktif',
            ],
        ];

        $rows = array_map(function (array $p) use ($now): array {
            return [
                'id' => SeedUuid::forProduction($p['area'], $p['production_type']),
                'area' => $p['area'],
                'production_type' => $p['production_type'],
                'courier_id' => $p['courier'] !== null ? SeedUuid::forPerson($p['courier']) : null,
                'status' => $p['status'],
                'version' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }, $productions);

        DB::table('productions')->upsert(
            $rows,
            ['id'],
            ['area', 'production_type', 'courier_id', 'status', 'updated_at']
        );
    }
}
