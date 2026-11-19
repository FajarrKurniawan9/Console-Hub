<?php

namespace App\Support;

use App\Models\Transaction;

/**
 * The one place where console refusal codes become sentences.
 *
 * Admin IT sees the console's own message and the refusal list. User sees an everyday sentence built
 * from the refusal `details`, with no console name, transaction id or technical code.
 *
 * Details each console sends with a refusal (also implemented by tools/console-stub):
 *   DIVISION_NOT_EMPTY {division_name, active_employees}   DIVISION_INACTIVE {division_name}
 *   EMPLOYEE_HAS_OPEN_ORDERS {employee_name, open_orders}  PIC_INACTIVE {employee_name}
 *   PIC_OVERLOADED {employee_name, open_orders, max}       INSUFFICIENT_STOCK {sku, item_name, available, required}
 *   ITEM_HAS_STOCK {item_name, stock, unit}                ITEM_IN_OPEN_ORDER {item_name, open_orders}
 *   ITEM_INACTIVE {item_name}                              ITEM_NOT_FINISHED_GOOD {item_name}
 *   INVALID_STATE {order_code, status}                     DUPLICATE_CODE {code}
 */
class ApiError
{
    public const SERVICE_DOWN = 'Layanan sedang bermasalah. Tidak ada data yang berubah; coba lagi beberapa menit lagi.';

    public const VERSION_CONFLICT = 'Data ini baru saja diubah orang lain. Muat ulang lalu coba lagi.';

    public const LOCKED = 'Data ini sedang diproses perubahan lain. Tunggu sebentar, muat ulang, lalu coba lagi.';

    /** Codes that mean "someone else changed it", answered as their own 409 instead of TRANSACTION_REFUSED. */
    public const CONCURRENCY_CODES = ['VERSION_CONFLICT', 'LOCKED'];

    /**
     * Everyday sentence for a refusal.
     *
     * @param  array<string, mixed>  $d
     */
    public static function refusalSentence(string $code, array $d): string
    {
        $v = fn (string $key, string $fallback = '') => isset($d[$key]) && is_scalar($d[$key]) ? (string) $d[$key] : $fallback;

        return match ($code) {
            'DIVISION_NOT_EMPTY' => "Divisi {$v('division_name', 'ini')} tidak dapat dinonaktifkan: masih ada {$v('active_employees', 'beberapa')} karyawan aktif. Pindahkan atau nonaktifkan mereka dulu.",
            'DIVISION_INACTIVE' => "Divisi {$v('division_name', 'yang dipilih')} sudah tidak aktif. Pilih divisi lain.",
            'EMPLOYEE_HAS_OPEN_ORDERS' => "{$v('employee_name', 'Karyawan ini')} tidak dapat dinonaktifkan: masih memegang {$v('open_orders', 'beberapa')} pesanan yang belum selesai.",
            'PIC_INACTIVE' => "Penanggung jawab {$v('employee_name')} sudah tidak aktif. Pilih penanggung jawab lain.",
            'PIC_OVERLOADED' => "Pesanan tidak dapat dibuat: {$v('employee_name', 'penanggung jawab ini')} sudah memegang {$v('open_orders', $v('max', '5'))} pesanan yang belum selesai. Pilih penanggung jawab lain.",
            'INSUFFICIENT_STOCK' => "Pesanan tidak dapat dibuat: stok {$v('item_name', $v('sku', 'barang'))} tidak cukup (tersedia {$v('available', '?')}, dibutuhkan {$v('required', '?')}).",
            'ITEM_HAS_STOCK' => "{$v('item_name', 'Barang ini')} masih memiliki stok {$v('stock', '')} {$v('unit', '')}. Habiskan atau pindahkan stoknya dulu.",
            'ITEM_IN_OPEN_ORDER' => "{$v('item_name', 'Barang ini')} masih dipakai di {$v('open_orders', 'beberapa')} pesanan yang belum selesai.",
            'ITEM_INACTIVE' => "Pesanan tidak dapat dibuat: {$v('item_name', 'salah satu barang')} sudah tidak aktif.",
            'ITEM_NOT_FINISHED_GOOD' => "Pesanan tidak dapat dibuat: {$v('item_name', 'salah satu barang')} bukan barang jadi.",
            'INVALID_STATE' => "Pesanan {$v('order_code')} sudah tidak dalam antrean, jadi tidak dapat diubah lagi.",
            'DUPLICATE_CODE' => "Kode {$v('code')} sudah dipakai. Gunakan kode lain.",
            'VERSION_CONFLICT' => self::VERSION_CONFLICT,
            'LOCKED' => self::LOCKED,
            default => 'Perubahan tidak dapat disimpan. Tidak ada data yang berubah.',
        };
    }

    /**
     * The error answered for a transaction that was decided `abort`.
     */
    public static function forAbortedTransaction(Transaction $tx, bool $technical): ApiException
    {
        $code = (string) $tx->failure_code;

        if (in_array($code, self::CONCURRENCY_CODES, true)) {
            return new ApiException(409, $code, $code === 'LOCKED' ? self::LOCKED : self::VERSION_CONFLICT, details: $technical ? ['tx_id' => $tx->id] : []);
        }

        $refusals = $tx->participants->where('prepare_state', 'refused')->sortBy('console_id')->values();

        if ($refusals->isNotEmpty()) {
            if (! $technical) {
                $sentences = $refusals->map(fn ($p) => self::refusalSentence((string) $p->refusal_code, (array) ($tx->result['refusal_details'][$p->console->slug] ?? [])))->unique()->values();

                return new ApiException(409, 'TRANSACTION_REFUSED', $sentences->implode(' '));
            }

            return new ApiException(409, 'TRANSACTION_REFUSED', $refusals->map(fn ($p) => "{$p->console->name}: {$p->refusal_message}")->implode(' '), details: [
                'tx_id' => $tx->id,
                'refusals' => $refusals->map(fn ($p) => ['console' => $p->console->name, 'code' => $p->refusal_code, 'message' => (string) $p->refusal_message])->all(),
            ]);
        }

        $errorCode = in_array($code, ['CONSOLE_TIMEOUT', 'CONSOLE_ERROR'], true) ? $code : 'CONSOLE_UNREACHABLE';
        $status = $errorCode === 'CONSOLE_TIMEOUT' ? 504 : 502;

        return $technical
            ? new ApiException($status, $errorCode, trim($tx->failure_message.' Tidak ada data yang berubah.'), console: $tx->failure_console, details: ['tx_id' => $tx->id])
            : new ApiException($status, $errorCode, self::SERVICE_DOWN);
    }

    /**
     * Sentence for `GET /transactions/{id}` (the owner of a 202 write).
     */
    public static function statusMessage(Transaction $tx): ?string
    {
        return match ($tx->state) {
            'committed' => 'Perubahan sudah tersimpan.',
            'needs_attention' => 'Perubahan sudah dicatat, tetapi belum selesai di semua bagian sistem. Admin IT sudah diberi tahu dan akan menyelesaikannya.',
            'aborted', 'aborting' => 'Perubahan dibatalkan. Tidak ada data yang berubah.',
            default => 'Perubahan sedang diselesaikan.',
        };
    }
}
