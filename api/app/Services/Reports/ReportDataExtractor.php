<?php

namespace App\Services\Reports;

use App\Models\AuditEvent;
use App\Models\Console;
use App\Models\LogEntry;
use App\Models\ReportExport;
use App\Services\Domain\RecordService;
use App\Support\Iso;
use Generator;
use Illuminate\Support\Carbon;
use InvalidArgumentException;
use Throwable;

class ReportDataExtractor
{
    public const MAX_ROWS = 10000;

    private const MAX_REMOTE_PAGES = 100;

    private const VALID_LOG_LEVELS = ['debug', 'info', 'warn', 'error'];

    public function __construct(private RecordService $records) {}

    /**
     * Column key => header label mapping for each supported report type.
     *
     * @return array<string, string>
     */
    public function columnsFor(string $type): array
    {
        return match ($type) {
            ReportExport::TYPE_AUDIT => [
                'id' => 'ID',
                'waktu_utc' => 'Waktu (UTC)',
                'pengguna' => 'Pengguna',
                'aksi' => 'Aksi',
                'target_type' => 'Tipe Target',
                'target_id' => 'ID Target',
                'console' => 'Console',
                'detail' => 'Detail',
            ],
            ReportExport::TYPE_LOGS => [
                'id' => 'ID',
                'waktu_utc' => 'Waktu (UTC)',
                'console' => 'Console',
                'level' => 'Level',
                'pesan' => 'Pesan',
                'aktor' => 'Aktor',
                'tx_id' => 'ID Transaksi',
            ],
            ReportExport::TYPE_BARANG => [
                'id' => 'ID',
                'nama' => 'Nama Barang',
                'jenis' => 'Jenis',
                'asal_produksi' => 'Asal Produksi',
                'penanggung_jawab' => 'Penanggung Jawab',
                'jumlah' => 'Jumlah',
                'satuan' => 'Satuan',
                'status' => 'Status',
                'versi' => 'Versi',
                'diperbarui_utc' => 'Diperbarui (UTC)',
            ],
            default => throw new InvalidArgumentException("Tipe laporan tidak dikenal: {$type}"),
        };
    }

    /**
     * Stream formatted rows for the given report type and filter set.
     *
     * @param  array<string, mixed>  $filters
     * @return Generator<int, array<string, scalar|null>>
     */
    public function extract(string $type, array $filters): Generator
    {
        return match ($type) {
            ReportExport::TYPE_AUDIT => $this->extractAudit($filters),
            ReportExport::TYPE_LOGS => $this->extractLogs($filters),
            ReportExport::TYPE_BARANG => $this->extractBarang($filters),
            default => throw new InvalidArgumentException("Tipe laporan tidak dikenal: {$type}"),
        };
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Generator<int, array<string, scalar|null>>
     */
    private function extractAudit(array $filters): Generator
    {
        $query = AuditEvent::query()->with('user:id,name');

        $userId = $this->positiveInt($filters['user_id'] ?? null);
        if ($userId !== null) {
            $query->where('user_id', $userId);
        }

        $consoleId = $this->positiveInt($filters['console_id'] ?? null);
        if ($consoleId !== null) {
            $slug = Console::query()->whereKey($consoleId)->value('slug');
            if ($slug === null) {
                return;
            }
            $query->where('new_value->console', $slug);
        }

        if (is_string($filters['action'] ?? null) && trim($filters['action']) !== '') {
            $query->where('action', trim($filters['action']));
        }

        if (($from = $this->parseDate($filters['from'] ?? null)) !== null) {
            $query->where('created_at', '>=', $from);
        }

        if (($to = $this->parseDate($filters['to'] ?? null)) !== null) {
            $query->where('created_at', '<=', $to);
        }

        $emitted = 0;

        foreach ($query->orderByDesc('created_at')->orderByDesc('id')->lazy(500) as $event) {
            /** @var AuditEvent $event */
            if ($emitted >= self::MAX_ROWS) {
                break;
            }

            $newValue = is_array($event->new_value) ? $event->new_value : [];
            $consoleSlug = is_string($newValue['console'] ?? null) ? $newValue['console'] : null;

            yield [
                'id' => $event->id,
                'waktu_utc' => Iso::utc($event->created_at),
                'pengguna' => $event->user->name ?? 'sistem',
                'aksi' => $event->action,
                'target_type' => $event->subject_type,
                'target_id' => $event->subject_id,
                'console' => $consoleSlug,
                'detail' => $newValue === [] ? null : json_encode($newValue, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ];

            $emitted++;
        }
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Generator<int, array<string, scalar|null>>
     */
    private function extractLogs(array $filters): Generator
    {
        $query = LogEntry::query()->with('console:id,slug,name');

        $consoleIds = array_values(array_filter(
            array_map(fn (string $v) => ctype_digit($v) ? (int) $v : 0, $this->stringList($filters['console_id'] ?? null)),
            fn (int $id) => $id > 0,
        ));
        if ($consoleIds !== []) {
            $query->whereIn('console_id', $consoleIds);
        }

        $levels = array_values(array_intersect($this->stringList($filters['level'] ?? null), self::VALID_LOG_LEVELS));
        if ($levels !== []) {
            $query->whereIn('level', $levels);
        }

        if (is_string($filters['q'] ?? null) && trim($filters['q']) !== '') {
            $like = '%'.addcslashes(trim($filters['q']), '%_\\').'%';
            $query->where(fn ($q) => $q->where('message', 'ilike', $like)
                ->orWhere('actor', 'ilike', $like)
                ->orWhereRaw('tx_id::text ilike ?', [$like]));
        }

        if (($from = $this->parseDate($filters['from'] ?? null)) !== null) {
            $query->where('occurred_at', '>=', $from);
        }

        if (($to = $this->parseDate($filters['to'] ?? null)) !== null) {
            $query->where('occurred_at', '<=', $to);
        }

        $emitted = 0;

        foreach ($query->orderByDesc('occurred_at')->orderByDesc('id')->lazy(500) as $log) {
            /** @var LogEntry $log */
            if ($emitted >= self::MAX_ROWS) {
                break;
            }

            yield [
                'id' => $log->id,
                'waktu_utc' => Iso::utc($log->occurred_at),
                'console' => $log->console->name,
                'level' => $log->level,
                'pesan' => $log->message,
                'aktor' => $log->actor,
                'tx_id' => $log->tx_id,
            ];

            $emitted++;
        }
    }

    /**
     * Fetch items through the official Gudang HTTP API (enriched with Produksi and HR via RecordService).
     *
     * @param  array<string, mixed>  $filters
     * @return Generator<int, array<string, scalar|null>>
     */
    private function extractBarang(array $filters): Generator
    {
        $baseQuery = ['limit' => 100];

        if (is_string($filters['q'] ?? null) && trim($filters['q']) !== '') {
            $baseQuery['q'] = trim($filters['q']);
        }

        if (is_string($filters['status'] ?? null) && in_array($filters['status'], ['aktif', 'nonaktif', 'all'], true)) {
            $baseQuery['status'] = $filters['status'];
        }

        if (is_string($filters['kind'] ?? null) && trim($filters['kind']) !== '') {
            $baseQuery['kind'] = trim($filters['kind']);
        }

        $cursor = null;
        $seenCursors = [];
        $emitted = 0;

        for ($pageNum = 0; $pageNum < self::MAX_REMOTE_PAGES && $emitted < self::MAX_ROWS; $pageNum++) {
            $query = $cursor !== null ? [...$baseQuery, 'cursor' => $cursor] : $baseQuery;
            $page = $this->records->list('items', $query);

            foreach ($page['data'] as $row) {
                if ($emitted >= self::MAX_ROWS) {
                    break 2;
                }

                $production = is_array($row['production'] ?? null)
                    ? trim(((string) ($row['production']['area'] ?? '')).' · '.((string) ($row['production']['production_type'] ?? '')), ' ·')
                    : (is_string($row['production_id'] ?? null) ? $row['production_id'] : null);

                $responsible = is_array($row['responsible'] ?? null)
                    ? (is_string($row['responsible']['name'] ?? null) ? $row['responsible']['name'] : null)
                    : (is_string($row['responsible_id'] ?? null) ? $row['responsible_id'] : null);

                yield [
                    'id' => is_scalar($row['id'] ?? null) ? (string) $row['id'] : null,
                    'nama' => is_scalar($row['name'] ?? null) ? (string) $row['name'] : null,
                    'jenis' => is_scalar($row['kind'] ?? null) ? (string) $row['kind'] : null,
                    'asal_produksi' => $production === '' ? null : $production,
                    'penanggung_jawab' => $responsible,
                    'jumlah' => is_numeric($row['quantity'] ?? null) ? (int) $row['quantity'] : 0,
                    'satuan' => is_scalar($row['unit'] ?? null) ? (string) $row['unit'] : null,
                    'status' => is_scalar($row['status'] ?? null) ? (string) $row['status'] : null,
                    'versi' => is_numeric($row['version'] ?? null) ? (int) $row['version'] : null,
                    'diperbarui_utc' => is_scalar($row['updated_at'] ?? null) ? (string) $row['updated_at'] : null,
                ];

                $emitted++;
            }

            $nextCursor = $page['next_cursor'];
            if ($nextCursor === null || $nextCursor === '' || isset($seenCursors[$nextCursor])) {
                break;
            }

            $seenCursors[$nextCursor] = true;
            $cursor = $nextCursor;
        }
    }

    /**
     * @return list<string>
     */
    private function stringList(mixed $value): array
    {
        if (is_array($value)) {
            return array_values(array_filter(
                array_map(fn (mixed $item) => is_scalar($item) ? trim((string) $item) : '', $value),
                fn (string $v) => $v !== '',
            ));
        }

        if (is_string($value) && trim($value) !== '') {
            return array_values(array_filter(array_map('trim', explode(',', $value)), fn (string $v) => $v !== ''));
        }

        return [];
    }

    private function positiveInt(mixed $value): ?int
    {
        if (is_int($value) && $value > 0) {
            return $value;
        }

        if (is_string($value) && ctype_digit(trim($value))) {
            $parsed = (int) trim($value);

            return $parsed > 0 ? $parsed : null;
        }

        return null;
    }

    private function parseDate(mixed $value): ?Carbon
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        try {
            return Carbon::parse($value)->utc();
        } catch (Throwable) {
            return null;
        }
    }
}
