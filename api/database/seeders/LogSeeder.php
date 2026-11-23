<?php

namespace Database\Seeders;

use App\Models\Console;
use App\Models\LogEntry;
use App\Services\LogSync;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeder untuk mengisi log_entries dengan data aktivitas realistis
 * dari ketiga console (Gudang, Produksi, HR) agar halaman Log Gabungan
 * terisi dan bisa difilter berdasarkan console, level, rentang waktu, dan teks pencarian.
 */
class LogSeeder extends Seeder
{
    public function run(): void
    {
        $consoles = Console::all()->keyBy('slug');
        if ($consoles->isEmpty()) {
            $this->command->warn('Tidak ada console di database. Jalankan ConsoleSeeder terlebih dahulu.');
            return;
        }

        $now = CarbonImmutable::now();
        $sampleLogs = [
            'gudang' => [
                ['level' => 'info',  'message' => 'Stok awal barang #ITM-001 (Laptop Dell) diverifikasi', 'actor' => 'gudang-service'],
                ['level' => 'info',  'message' => 'Penerimaan batch barang masuk dari supplier PT Maju Jaya', 'actor' => 'petugas_gudang'],
                ['level' => 'warn',  'message' => 'Stok minimum tercapai untuk item Kertas A4 (sisa 5 rim)', 'actor' => 'inventory-bot'],
                ['level' => 'info',  'message' => 'Sinkronisasi lokasi rak blok B-04 selesai', 'actor' => 'system'],
                ['level' => 'error', 'message' => 'Gagal membaca barcode scanner #SCAN-03: format data invalid', 'actor' => 'device_scanner'],
                ['level' => 'info',  'message' => 'Pembaruan kuantitas barang item #ITM-014 berhasil', 'actor' => 'petugas_gudang'],
                ['level' => 'debug', 'message' => 'Heartbeat internal storage OK (latensi 42ms)', 'actor' => 'health-daemon'],
                ['level' => 'info',  'message' => 'Pengeluaran barang untuk produksi PRD-2026-11-09', 'actor' => 'operator_gudang'],
            ],
            'produksi' => [
                ['level' => 'info',  'message' => 'Perintah kerja SPK-2026-008 status berubah menjadi berjalan', 'actor' => 'supervisor_prod'],
                ['level' => 'warn',  'message' => 'Mesin CNC-02 memerlukan kalibrasi ulang suhu nozzle', 'actor' => 'iot_sensor'],
                ['level' => 'info',  'message' => 'Batch produksi 500 unit selesai tahap perakitan', 'actor' => 'mesin_assy'],
                ['level' => 'error', 'message' => 'Downtime lini 1: material plat besi habis, menunggu suplai gudang', 'actor' => 'lini_assembly'],
                ['level' => 'info',  'message' => 'Pemeriksaan Quality Control batch QC-889 lolos 99.2%', 'actor' => 'qc_inspector'],
                ['level' => 'debug', 'message' => 'Metrik sensor IoT suhu 78.4°C, vibrasi normal', 'actor' => 'iot_agent'],
                ['level' => 'info',  'message' => 'Operator shift siang mulai bertugas (12 personil)', 'actor' => 'lead_shift'],
            ],
            'hr' => [
                ['level' => 'info',  'message' => 'Presensi shift pagi dicatat: 48 personil hadir tepat waktu', 'actor' => 'biometric_gate'],
                ['level' => 'info',  'message' => 'Pembaruan data sertifikasi K3 untuk 3 teknisi mesin', 'actor' => 'hr_admin'],
                ['level' => 'warn',  'message' => 'Sertifikat operator forklift Ahmad Fauzi akan kedaluwarsa dalam 7 hari', 'actor' => 'hr_compliance'],
                ['level' => 'info',  'message' => 'Penugasan lembur darurat shift malam disetujui manajer', 'actor' => 'hr_supervisor'],
                ['level' => 'debug', 'message' => 'Sync data karyawan dengan modul penggajian selesai', 'actor' => 'payroll_cron'],
            ],
        ];

        $rows = [];

        // Buat log tersebar dalam 48 jam terakhir sampai beberapa menit yang lalu
        foreach ($sampleLogs as $slug => $items) {
            $console = $consoles->get($slug);
            if (! $console) {
                continue;
            }

            foreach ($items as $index => $item) {
                // Distribusi waktu: mundur dari 10 menit lalu sampai 40 jam lalu
                $minutesAgo = ($index * 110) + rand(5, 45);
                $occurredAt = $now->subMinutes($minutesAgo);
                $txId = (rand(1, 10) <= 4) ? Str::uuid()->toString() : null;

                $raw = [
                    'source' => $slug,
                    'level' => $item['level'],
                    'message' => $item['message'],
                    'actor' => $item['actor'],
                    'occurred_at' => $occurredAt->toIso8601ZuluString(),
                    'tx_id' => $txId,
                ];

                $fingerprint = LogSync::fingerprint(
                    $console->id,
                    $occurredAt,
                    $item['message'],
                    $item['actor']
                );

                $rows[] = [
                    'console_id'  => $console->id,
                    'occurred_at' => $occurredAt,
                    'level'       => $item['level'],
                    'message'     => $item['message'],
                    'actor'       => $item['actor'],
                    'tx_id'       => $txId,
                    'raw'         => json_encode($raw, JSON_UNESCAPED_UNICODE),
                    'fingerprint' => $fingerprint,
                ];
            }
        }

        // Simpan ke database
        LogEntry::query()->insertOrIgnore($rows);

        $this->command->info('Berhasil menambahkan ' . count($rows) . ' sample log entries untuk 3 console.');
    }
}
