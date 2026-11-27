<?php

namespace App\Console\Commands;

use App\Models\DataImport;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('imports:prune {--preview-hours=24 : Tandai preview expired setelah N jam} {--payload-days=7 : Kosongkan payload source/plan tiket selesai setelah N hari} {--days=14 : Hapus riwayat tiket selesai/batal/gagal/expired setelah N hari}')]
#[Description('Kedaluwarsakan pratinjau impor lama, bersihkan payload besar, dan hapus riwayat impor lama')]
class ImportsPrune extends Command
{
    public function handle(): int
    {
        $previewHours = max(1, (int) $this->option('preview-hours'));
        $payloadDays = max(1, (int) $this->option('payload-days'));
        $days = max(1, (int) $this->option('days'));

        $expired = DataImport::query()
            ->where('status', DataImport::STATUS_PREVIEW)
            ->where('created_at', '<', now()->subHours($previewHours))
            ->update([
                'status' => DataImport::STATUS_EXPIRED,
                'source_rows' => null,
                'plan_rows' => null,
            ]);

        $cleanedPayloads = DataImport::query()
            ->whereIn('status', DataImport::TERMINAL_STATUSES)
            ->where(fn ($q) => $q->whereNotNull('source_rows')->orWhereNotNull('plan_rows'))
            ->where('updated_at', '<', now()->subDays($payloadDays))
            ->update([
                'source_rows' => null,
                'plan_rows' => null,
            ]);

        $deleted = DataImport::query()
            ->whereNotIn('status', DataImport::NON_PRUNABLE_STATUSES)
            ->whereIn('status', DataImport::TERMINAL_STATUSES)
            ->where('created_at', '<', now()->subDays($days))
            ->delete();

        $this->info("Kedaluwarsa: {$expired}, payload dibersihkan: {$cleanedPayloads}, dihapus: {$deleted}.");

        return self::SUCCESS;
    }
}
