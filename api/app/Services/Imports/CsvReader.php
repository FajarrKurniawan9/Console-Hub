<?php

namespace App\Services\Imports;

use App\Support\ApiException;

/**
 * Reads UTF-8 CSV files with BOM stripping, auto-detected `,` / `;` delimiter, and strict row limits.
 */
class CsvReader
{
    public const MAX_DATA_ROWS = 300;

    /**
     * Parse CSV into non-empty trimmed rows with 1-based physical row numbers.
     *
     * @return list<array{row_number: int, cells: list<string>}>
     */
    public function read(string $path): array
    {
        $raw = @file_get_contents($path);

        if (! is_string($raw)) {
            throw ApiException::validation(['file' => ['File CSV tidak dapat dibaca.']]);
        }

        if (str_starts_with($raw, "\xEF\xBB\xBF")) {
            $raw = substr($raw, 3);
        }

        if ($raw === '' || trim($raw) === '') {
            return [];
        }

        if (str_contains($raw, "\x00") || ! mb_check_encoding($raw, 'UTF-8')) {
            throw ApiException::validation(['file' => ['File CSV harus berformat teks UTF-8 yang valid.']]);
        }

        $normalized = str_replace(["\r\n", "\r"], "\n", $raw);
        $delimiter = $this->detectDelimiter($normalized);

        $handle = fopen('php://temp', 'r+b');

        if ($handle === false) {
            throw ApiException::validation(['file' => ['Gagal memproses stream file CSV.']]);
        }

        try {
            fwrite($handle, $normalized);
            rewind($handle);

            $rows = [];
            $lineNumber = 0;

            while (($record = fgetcsv($handle, null, $delimiter, '"', '')) !== false) {
                $lineNumber++;
                $cells = array_map(
                    static fn (mixed $cell): string => trim((string) ($cell ?? '')),
                    $record,
                );

                if ($this->isRowEmpty($cells)) {
                    continue;
                }

                $rows[] = [
                    'row_number' => $lineNumber,
                    'cells' => $cells,
                ];

                if (count($rows) > (self::MAX_DATA_ROWS + 1)) {
                    throw ApiException::validation(['file' => ['Jumlah baris data melebihi batas maksimal 300 baris.']]);
                }
            }

            return $rows;
        } finally {
            fclose($handle);
        }
    }

    private function detectDelimiter(string $content): string
    {
        $firstLine = '';

        foreach (explode("\n", $content) as $line) {
            if (trim($line) !== '') {
                $firstLine = $line;

                break;
            }
        }

        $commaCount = 0;
        $semiCount = 0;
        $inQuotes = false;
        $len = strlen($firstLine);

        for ($i = 0; $i < $len; $i++) {
            $char = $firstLine[$i];

            if ($char === '"') {
                $inQuotes = ! $inQuotes;

                continue;
            }

            if ($inQuotes) {
                continue;
            }

            if ($char === ',') {
                $commaCount++;
            } elseif ($char === ';') {
                $semiCount++;
            }
        }

        return $semiCount > $commaCount ? ';' : ',';
    }

    /**
     * @param  list<string>  $cells
     */
    private function isRowEmpty(array $cells): bool
    {
        foreach ($cells as $cell) {
            if ($cell !== '') {
                return false;
            }
        }

        return true;
    }
}
