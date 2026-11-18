<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        // 1. SEED USERS (1 Admin & 1 User Biasa)
        DB::table('users')->updateOrInsert(
            ['email' => 'admin@consolehub.local'],
            [
                'name' => 'Admin',
                'password' => Hash::make('123456789'),
                'is_admin' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );

        DB::table('users')->updateOrInsert(
            ['email' => 'operator@consolehub.local'],
            [
                'name' => 'Operator Produksi',
                'password' => Hash::make('123456789'),
                'is_admin' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );

        $adminId = DB::table('users')->where('email', 'admin@consolehub.local')->value('id');

        // 2. SEED CONSOLES (HR, Gudang, Produksi)
        $consoles = [
            [
                'slug' => 'hr-console',
                'name' => 'HR Management Console',
                'base_url' => 'http://localhost:4001/api',
                'auth_type' => 'bearer',
                'credentials' => 'mock-token-hr-001',
                'config' => json_encode(['version' => 'v1', 'department' => 'HR']),
                'timezone' => 'Asia/Jakarta',
                'is_active' => true,
                'status' => 'unknown',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'slug' => 'gudang-console',
                'name' => 'Warehouse Inventory Console',
                'base_url' => 'http://localhost:4002/api',
                'auth_type' => 'api_key',
                'credentials' => 'mock-apikey-gudang-002',
                'config' => json_encode(['version' => 'v1', 'department' => 'Warehouse']),
                'timezone' => 'Asia/Jakarta',
                'is_active' => true,
                'status' => 'unknown',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'slug' => 'produksi-console',
                'name' => 'Production Line Console',
                'base_url' => 'http://localhost:4003/api',
                'auth_type' => 'bearer',
                'credentials' => 'mock-token-produksi-003',
                'config' => json_encode(['version' => 'v1', 'department' => 'Production']),
                'timezone' => 'Asia/Jakarta',
                'is_active' => true,
                'status' => 'unknown',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        foreach ($consoles as $console) {
            DB::table('consoles')->updateOrInsert(
                ['slug' => $console['slug']],
                $console
            );
        }

        $hrId = DB::table('consoles')->where('slug', 'hr-console')->value('id');
        $gudangId = DB::table('consoles')->where('slug', 'gudang-console')->value('id');
        $produksiId = DB::table('consoles')->where('slug', 'produksi-console')->value('id');

        // 3. SEED 3 CONTOH PROCESSES & PROCESS STEPS
        $processesData = [
            // Proses 1: Permintaan Bahan Baku Produksi (dengan kompensasi jika gagal)
            [
                'name' => 'Permintaan Bahan Baku Produksi',
                'description' => 'Validasi PIC di HR, reservasi stok bahan baku (SKU-BB) di Gudang, lalu buat Work Order di Produksi.',
                'is_active' => true,
                'input_schema' => json_encode([
                    'nik' => 'string',
                    'sku_bb' => 'string',
                    'qty' => 'integer',
                ]),
                'compensate_on_failure' => true,
                'steps' => [
                    [
                        'position' => 1,
                        'name' => 'Verifikasi Karyawan Aktif',
                        'console_id' => $hrId,
                        'method' => 'GET',
                        'path' => '/employees/{{input.nik}}',
                        'body_template' => null,
                        'expect_status' => json_encode([200]),
                        'timeout_seconds' => 10,
                        'max_retries' => 1,
                        'on_failure' => 'stop',
                        'compensation' => null,
                    ],
                    [
                        'position' => 2,
                        'name' => 'Reservasi Stok Bahan Baku',
                        'console_id' => $gudangId,
                        'method' => 'POST',
                        'path' => '/stock/reserve',
                        'body_template' => json_encode(['sku' => '{{input.sku_bb}}', 'qty' => '{{input.qty}}']),
                        'expect_status' => json_encode([200, 201]),
                        'timeout_seconds' => 10,
                        'max_retries' => 0,
                        'on_failure' => 'stop',
                        'compensation' => json_encode(['method' => 'POST', 'path' => '/stock/release']),
                    ],
                    [
                        'position' => 3,
                        'name' => 'Buat Work Order Produksi',
                        'console_id' => $produksiId,
                        'method' => 'POST',
                        'path' => '/work-orders',
                        'body_template' => json_encode([
                            'pic_nik' => '{{input.nik}}',
                            'sku' => '{{input.sku_bb}}',
                            'qty' => '{{input.qty}}',
                        ]),
                        'expect_status' => json_encode([201]),
                        'timeout_seconds' => 15,
                        'max_retries' => 0,
                        'on_failure' => 'stop',
                        'compensation' => null,
                    ],
                ],
            ],

            // Proses 2: Penyelesaian Batch & Barang Jadi Masuk Gudang
            [
                'name' => 'Penerimaan Barang Jadi ke Gudang',
                'description' => 'Tutup status batch di Produksi lalu catat penambahan stok barang jadi (SKU-BJ) di Gudang.',
                'is_active' => true,
                'input_schema' => json_encode([
                    'batch_code' => 'string',
                    'sku_bj' => 'string',
                    'qty_hasil' => 'integer',
                ]),
                'compensate_on_failure' => false,
                'steps' => [
                    [
                        'position' => 1,
                        'name' => 'Selesaikan Batch Produksi',
                        'console_id' => $produksiId,
                        'method' => 'PATCH',
                        'path' => '/batches/{{input.batch_code}}/complete',
                        'body_template' => json_encode(['qty_produced' => '{{input.qty_hasil}}']),
                        'expect_status' => json_encode([200]),
                        'timeout_seconds' => 10,
                        'max_retries' => 1,
                        'on_failure' => 'stop',
                        'compensation' => null,
                    ],
                    [
                        'position' => 2,
                        'name' => 'Tambah Stok Barang Jadi',
                        'console_id' => $gudangId,
                        'method' => 'POST',
                        'path' => '/stock/inbound',
                        'body_template' => json_encode([
                            'sku' => '{{input.sku_bj}}',
                            'qty' => '{{input.qty_hasil}}',
                            'ref_batch' => '{{input.batch_code}}',
                        ]),
                        'expect_status' => json_encode([200, 201]),
                        'timeout_seconds' => 10,
                        'max_retries' => 1,
                        'on_failure' => 'stop',
                        'compensation' => null,
                    ],
                ],
            ],

            // Proses 3: Penugasan Shift Operator Line Produksi
            [
                'name' => 'Sinkronisasi Shift Operator Line',
                'description' => 'Ambil jadwal shift aktif dari HR dan daftarkan operator ke line Produksi.',
                'is_active' => true,
                'input_schema' => json_encode([
                    'nik' => 'string',
                    'line_code' => 'string',
                    'shift' => 'string',
                ]),
                'compensate_on_failure' => false,
                'steps' => [
                    [
                        'position' => 1,
                        'name' => 'Cek Jadwal Shift di HR',
                        'console_id' => $hrId,
                        'method' => 'GET',
                        'path' => '/employees/{{input.nik}}/schedule',
                        'body_template' => null,
                        'expect_status' => json_encode([200]),
                        'timeout_seconds' => 10,
                        'max_retries' => 1,
                        'on_failure' => 'stop',
                        'compensation' => null,
                    ],
                    [
                        'position' => 2,
                        'name' => 'Assign Operator ke Line Produksi',
                        'console_id' => $produksiId,
                        'method' => 'POST',
                        'path' => '/lines/{{input.line_code}}/operators',
                        'body_template' => json_encode([
                            'nik' => '{{input.nik}}',
                            'shift' => '{{input.shift}}',
                        ]),
                        'expect_status' => json_encode([200, 201]),
                        'timeout_seconds' => 10,
                        'max_retries' => 0,
                        'on_failure' => 'continue',
                        'compensation' => null,
                    ],
                ],
            ],
        ];

        foreach ($processesData as $proc) {
            $steps = $proc['steps'];
            unset($proc['steps']);

            $existingProcess = DB::table('processes')->where('name', $proc['name'])->first();

            if ($existingProcess) {
                $processId = $existingProcess->id;
                DB::table('processes')->where('id', $processId)->update([
                    'description' => $proc['description'],
                    'is_active' => $proc['is_active'],
                    'input_schema' => $proc['input_schema'],
                    'compensate_on_failure' => $proc['compensate_on_failure'],
                    'created_by' => $adminId,
                    'updated_at' => $now,
                ]);
            } else {
                $processId = DB::table('processes')->insertGetId(array_merge($proc, [
                    'created_by' => $adminId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]));
            }

            foreach ($steps as $step) {
                DB::table('process_steps')->updateOrInsert(
                    [
                        'process_id' => $processId,
                        'position' => $step['position'],
                    ],
                    $step
                );
            }
        }
    }
}
