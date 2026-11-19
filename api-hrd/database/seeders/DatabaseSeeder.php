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

        $people = [
            ['name' => 'Budi Santoso', 'role' => 'Kepala Gudang', 'status' => 'aktif'],
            ['name' => 'Siti Rahmawati', 'role' => 'Staf Gudang', 'status' => 'aktif'],
            ['name' => 'Agus Pratama', 'role' => 'Staf Gudang', 'status' => 'aktif'],
            ['name' => 'Dewi Lestari', 'role' => 'Supervisor Distribusi', 'status' => 'aktif'],
            ['name' => 'Rizky Hidayat', 'role' => 'Kurir', 'status' => 'aktif'],
            ['name' => 'Hendra Wijaya', 'role' => 'Kurir', 'status' => 'aktif'],
            ['name' => 'Fajar Nugroho', 'role' => 'Kurir', 'status' => 'aktif'],
            ['name' => 'Andi Saputra', 'role' => 'Operator Produksi', 'status' => 'aktif'],
            ['name' => 'Rina Marlina', 'role' => 'Operator Produksi', 'status' => 'aktif'],
            ['name' => 'Dimas Kurniawan', 'role' => 'Admin Pencatatan', 'status' => 'aktif'],
            ['name' => 'Putri Ayu', 'role' => 'Staf Gudang', 'status' => 'aktif'],
            ['name' => 'Bambang Susilo', 'role' => 'Kurir', 'status' => 'nonaktif'],
        ];

        $rows = array_map(function (array $person) use ($now): array {
            return [
                'id' => SeedUuid::forPerson($person['name']),
                'name' => $person['name'],
                'role' => $person['role'],
                'status' => $person['status'],
                'version' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }, $people);

        DB::table('people')->upsert(
            $rows,
            ['id'],
            ['name', 'role', 'status', 'updated_at']
        );
    }
}
