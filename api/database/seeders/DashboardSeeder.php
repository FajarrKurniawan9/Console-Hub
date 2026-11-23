<?php

namespace Database\Seeders;

use App\Models\AuditEvent;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Mengisi audit_events dengan aktivitas item fiktif 30 hari ke belakang
 * agar grafik tren dan KPI di halaman Dashboard terlihat berisi.
 *
 * Data dibuat realistis: lebih banyak created di awal periode,
 * updated tersebar merata, deactivated sporadis.
 */
class DashboardSeeder extends Seeder
{
    /** Jenis-jenis barang yang ada di gudang (sama dengan kind di Gudang API). */
    private const KINDS = ['Elektronik', 'Perabot', 'ATK', 'Bahan Baku', 'Spare Part', 'Konsumsi'];

    /** Distribusi item per jenis: [kind => [min_qty, max_qty, item_count]] */
    private const KIND_WEIGHTS = [
        'Elektronik'  => [2, 10,  8],
        'Perabot'     => [1,  5,  6],
        'ATK'         => [5, 50, 12],
        'Bahan Baku'  => [10, 200, 10],
        'Spare Part'  => [1, 30,  9],
        'Konsumsi'    => [5, 100, 7],
    ];

    public function run(): void
    {
        // Ambil user yang ada (bisa admin atau manajer)
        $admin    = User::query()->whereHas('role', fn ($q) => $q->where('code', 'admin_it'))->first();
        $manajer  = User::query()->whereHas('role', fn ($q) => $q->where('code', 'manajer_gudang'))->first();

        // Fallback kalau tidak ada user sama sekali
        $actorIds = array_filter([
            $admin?->id,
            $manajer?->id,
        ]);
        if (empty($actorIds)) {
            $actorIds = User::query()->limit(2)->pluck('id')->toArray();
        }
        if (empty($actorIds)) {
            $this->command->warn('Tidak ada user di database. Jalankan UserSeeder terlebih dahulu.');
            return;
        }

        $this->command->info('Membuat data audit_events untuk dashboard...');

        // Hapus data lama agar idempoten (aman dijalankan berulang)
        AuditEvent::query()
            ->whereIn('action', ['item.created', 'item.updated', 'item.deactivated'])
            ->where('subject_type', 'item')
            ->delete();

        $rows = [];
        $now  = Carbon::now();

        // ── 1. Buat "riwayat masuk barang" selama 30 hari ke belakang ──────────
        foreach (self::KIND_WEIGHTS as $kind => [$minQty, $maxQty, $count]) {
            for ($i = 0; $i < $count; $i++) {
                // Waktu created: tersebar acak dalam 30 hari
                $createdAt = $now->copy()->subDays(rand(0, 29))->subHours(rand(0, 23));
                $itemId    = (string) Str::uuid();

                // item.created
                $rows[] = $this->row(
                    action:      'item.created',
                    subjectId:   $itemId,
                    actorIds:    $actorIds,
                    createdAt:   $createdAt,
                    newValue:    [
                        'name'     => $this->fakeName($kind, $i),
                        'kind'     => $kind,
                        'quantity' => rand($minQty, $maxQty),
                        'status'   => 'aktif',
                    ],
                );

                // item.updated — 60% item punya 1-3 update setelah created
                if (rand(1, 10) <= 6) {
                    $updateCount = rand(1, 3);
                    for ($u = 0; $u < $updateCount; $u++) {
                        $updatedAt = $createdAt->copy()->addDays(rand(1, 7))->addHours(rand(0, 12));
                        if ($updatedAt->gt($now)) {
                            $updatedAt = $now->copy()->subMinutes(rand(1, 60));
                        }
                        $newQty = rand($minQty, $maxQty);
                        $rows[] = $this->row(
                            action:    'item.updated',
                            subjectId: $itemId,
                            actorIds:  $actorIds,
                            createdAt: $updatedAt,
                            oldValue:  ['quantity' => rand($minQty, $maxQty)],
                            newValue:  ['quantity' => $newQty],
                        );
                    }
                }

                // item.deactivated — 15% item dinonaktifkan
                if (rand(1, 100) <= 15) {
                    $deactAt = $createdAt->copy()->addDays(rand(3, 25));
                    if ($deactAt->gt($now)) {
                        $deactAt = $now->copy()->subHours(rand(1, 48));
                    }
                    $rows[] = $this->row(
                        action:    'item.deactivated',
                        subjectId: $itemId,
                        actorIds:  $actorIds,
                        createdAt: $deactAt,
                        oldValue:  ['status' => 'aktif'],
                        newValue:  ['status' => 'nonaktif'],
                    );
                }
            }
        }

        // ── 2. Insert batch ───────────────────────────────────────────────────
        // Chunk 100 agar tidak melebihi parameter limit PostgreSQL
        foreach (array_chunk($rows, 100) as $chunk) {
            AuditEvent::insert($chunk);
        }

        $counts = collect($rows)->countBy('action');
        $this->command->info(sprintf(
            'Selesai: %d item.created, %d item.updated, %d item.deactivated (%d total events)',
            $counts->get('item.created', 0),
            $counts->get('item.updated', 0),
            $counts->get('item.deactivated', 0),
            count($rows),
        ));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * @param  list<int>  $actorIds
     * @param  array<string, mixed>  $newValue
     * @param  array<string, mixed>  $oldValue
     * @return array<string, mixed>
     */
    private function row(
        string $action,
        string $subjectId,
        array $actorIds,
        Carbon $createdAt,
        array $newValue = [],
        array $oldValue = [],
    ): array {
        return [
            'user_id'      => $actorIds[array_rand($actorIds)],
            'action'       => $action,
            'subject_type' => 'item',
            'subject_id'   => $subjectId,
            'old_value'    => $oldValue ? json_encode($oldValue) : null,
            'new_value'    => $newValue ? json_encode($newValue) : null,
            'request_id'   => Str::uuid()->toString(),
            'created_at'   => $createdAt->toDateTimeString(),
        ];
    }

    private function fakeName(string $kind, int $index): string
    {
        $names = [
            'Elektronik' => ['Laptop Dell', 'Monitor LG', 'Keyboard Logitech', 'Mouse Wireless', 'Printer HP', 'UPS APC', 'Switch TP-Link', 'Webcam Logitech'],
            'Perabot'    => ['Meja Kerja', 'Kursi Ergonomis', 'Lemari Arsip', 'Rak Besi', 'Whiteboard', 'Loker Karyawan'],
            'ATK'        => ['Kertas A4', 'Pulpen Pilot', 'Spidol Whiteboard', 'Map Plastik', 'Stapler Besar', 'Tinta Printer', 'Amplop Coklat', 'Sticky Notes', 'Penggaris', 'Gunting', 'Lakban', 'Lem Kertas'],
            'Bahan Baku' => ['Besi Hollow 4x4', 'Plywood 18mm', 'Cat Tembok', 'Semen 50kg', 'Pasir Halus', 'Kawat Las', 'Pipa PVC', 'Cat Besi', 'Triplek', 'Baut 6mm'],
            'Spare Part' => ['Filter Udara', 'V-Belt', 'Bearing 6205', 'Oli Mesin', 'Kampas Rem', 'Busi', 'Oli Transmisi', 'Seal Kit', 'Rantai Motor'],
            'Konsumsi'   => ['Sabun Cuci', 'Tisu Box', 'Kopi Sachet', 'Gula 1kg', 'Air Galon', 'Deterjen'],
        ];

        $list = $names[$kind] ?? ["Item {$kind}"];

        return $list[$index % count($list)];
    }
}
