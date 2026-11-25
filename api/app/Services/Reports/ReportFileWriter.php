<?php

namespace App\Services\Reports;

use Generator;
use Illuminate\Support\Facades\Storage;
use InvalidArgumentException;
use RuntimeException;

class ReportFileWriter
{
    /** @var array<string, string> */
    private const MIME_TYPES = [
        'csv' => 'text/csv; charset=UTF-8',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'json' => 'application/json; charset=UTF-8',
    ];

    public function __construct(private XlsxWorkbookWriter $xlsx = new XlsxWorkbookWriter) {}

    public static function mimeTypeFor(string $format): string
    {
        return self::MIME_TYPES[$format] ?? 'application/octet-stream';
    }

    /**
     * Write rows to storage in CSV, XLSX, or JSON format and return the row count.
     *
     * @param  array<string, string>  $columns  key => header label
     * @param  iterable<array<string, scalar|null>>  $rows
     */
    public function write(string $disk, string $path, string $format, array $columns, iterable $rows): int
    {
        return match ($format) {
            'csv' => $this->writeCsv($disk, $path, $columns, $rows),
            'xlsx' => $this->writeXlsx($disk, $path, $columns, $rows),
            'json' => $this->writeJson($disk, $path, $columns, $rows),
            default => throw new InvalidArgumentException("Format ekspor tidak didukung: {$format}"),
        };
    }

    /**
     * @param  array<string, string>  $columns
     * @param  iterable<array<string, scalar|null>>  $rows
     */
    private function writeCsv(string $disk, string $path, array $columns, iterable $rows): int
    {
        $handle = fopen('php://temp', 'r+b');

        if ($handle === false) {
            throw new RuntimeException('Gagal membuka stream sementara untuk CSV.');
        }

        try {
            // UTF-8 BOM so Microsoft Excel detects Unicode automatically.
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, array_values($columns), ',', '"', '');

            $keys = array_keys($columns);
            $count = 0;

            foreach ($rows as $row) {
                $line = [];

                foreach ($keys as $key) {
                    $value = $this->sanitizeCell($row[$key] ?? null);
                    $line[] = $value === null ? '' : (is_bool($value) ? ($value ? 'true' : 'false') : (string) $value);
                }

                fputcsv($handle, $line, ',', '"', '');
                $count++;
            }

            rewind($handle);
            Storage::disk($disk)->writeStream($path, $handle);

            return $count;
        } finally {
            fclose($handle);
        }
    }

    /**
     * @param  array<string, string>  $columns
     * @param  iterable<array<string, scalar|null>>  $rows
     */
    private function writeJson(string $disk, string $path, array $columns, iterable $rows): int
    {
        $handle = fopen('php://temp', 'r+b');

        if ($handle === false) {
            throw new RuntimeException('Gagal membuka stream sementara untuk JSON.');
        }

        try {
            $keys = array_keys($columns);
            $count = 0;

            fwrite($handle, "[\n");

            foreach ($rows as $row) {
                $normalized = [];

                foreach ($keys as $key) {
                    $normalized[$key] = $row[$key] ?? null;
                }

                if ($count > 0) {
                    fwrite($handle, ",\n");
                }

                fwrite($handle, '  '.json_encode($normalized, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
                $count++;
            }

            fwrite($handle, $count > 0 ? "\n]\n" : "]\n");
            rewind($handle);
            Storage::disk($disk)->writeStream($path, $handle);

            return $count;
        } finally {
            fclose($handle);
        }
    }

    /**
     * @param  array<string, string>  $columns
     * @param  iterable<array<string, scalar|null>>  $rows
     */
    private function writeXlsx(string $disk, string $path, array $columns, iterable $rows): int
    {
        $tmpPath = tempnam(sys_get_temp_dir(), 'ch_xlsx_');

        if ($tmpPath === false) {
            throw new RuntimeException('Gagal membuat file sementara untuk XLSX.');
        }

        try {
            $keys = array_keys($columns);
            $sanitizedRows = $this->sanitizedRows($keys, $rows);
            $count = $this->xlsx->writeToFile($tmpPath, array_values($columns), $sanitizedRows);

            $stream = fopen($tmpPath, 'rb');

            if ($stream === false) {
                throw new RuntimeException('Gagal membaca file XLSX sementara.');
            }

            try {
                Storage::disk($disk)->writeStream($path, $stream);
            } finally {
                fclose($stream);
            }

            return $count;
        } finally {
            @unlink($tmpPath);
        }
    }

    /**
     * @param  list<string>  $keys
     * @param  iterable<array<string, scalar|null>>  $rows
     * @return Generator<int, list<bool|float|int|string|null>>
     */
    private function sanitizedRows(array $keys, iterable $rows): Generator
    {
        foreach ($rows as $row) {
            $values = [];

            foreach ($keys as $key) {
                $values[] = $this->sanitizeCell($row[$key] ?? null);
            }

            yield $values;
        }
    }

    /**
     * Neutralize spreadsheet formula injection when a string cell begins with an active character.
     */
    private function sanitizeCell(bool|float|int|string|null $value): bool|float|int|string|null
    {
        if (is_string($value) && $value !== '' && preg_match('/^[=+\-@\t\r]/', $value) === 1) {
            return "'".$value;
        }

        return $value;
    }
}
