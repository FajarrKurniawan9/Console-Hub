<?php

namespace App\Services\Imports;

use App\Models\DataImport;
use App\Support\ApiException;
use Illuminate\Http\UploadedFile;

/**
 * Validates uploaded CSV/XLSX files, enforces template header contracts, and normalizes rows.
 */
class TabularFileReader
{
    public const MAX_FILE_BYTES = 2_097_152; // 2 MB

    public const MAX_DATA_ROWS = 300;

    /** @var array<string, list<string>> */
    public const TEMPLATE_HEADERS = [
        DataImport::TYPE_USERS => ['name', 'email', 'role_code'],
        DataImport::TYPE_PERSONEL => ['id', 'name', 'role'],
        DataImport::TYPE_PRODUKSI => ['id', 'area', 'production_type', 'courier'],
        DataImport::TYPE_BARANG => ['id', 'name', 'kind', 'production', 'responsible', 'quantity', 'unit'],
    ];

    public function __construct(
        private CsvReader $csv = new CsvReader,
        private XlsxWorkbookReader $xlsx = new XlsxWorkbookReader,
    ) {}

    /**
     * @return list<string>
     */
    public static function expectedHeaders(string $type): array
    {
        return self::TEMPLATE_HEADERS[$type] ?? [];
    }

    /**
     * Validate and parse an uploaded CSV or XLSX file for the target entity type.
     *
     * @return array{format: 'csv'|'xlsx', filename: string, rows: list<array{row_number: int, values: array<string, string>}>}
     */
    public function read(UploadedFile $file, string $type): array
    {
        $realPath = $file->getRealPath();

        if (! is_string($realPath) || $realPath === '' || ! is_file($realPath)) {
            throw ApiException::validation(['file' => ['File unggahan tidak valid atau tidak ditemukan.']]);
        }

        $size = filesize($realPath);

        if ($size === false || $size === 0) {
            throw ApiException::validation(['file' => ['File unggahan kosong.']]);
        }

        if ($size > self::MAX_FILE_BYTES) {
            throw ApiException::validation(['file' => ['Ukuran file maksimal adalah 2 MB.']]);
        }

        $extension = strtolower($file->getClientOriginalExtension());

        if (! in_array($extension, DataImport::FORMATS, true)) {
            throw ApiException::validation(['file' => ['Format file harus berupa .csv atau .xlsx.']]);
        }

        $this->assertMagicBytes($realPath, $extension);

        $rawRows = $extension === 'xlsx'
            ? $this->xlsx->read($realPath)
            : $this->csv->read($realPath);

        if ($rawRows === []) {
            throw ApiException::validation(['file' => ['File tidak memiliki baris header maupun data.']]);
        }

        $headerRow = array_shift($rawRows);
        $headerMap = $this->validateAndMapHeaders($headerRow['cells'], $type);

        $dataRowCount = count($rawRows);

        if ($dataRowCount === 0) {
            throw ApiException::validation(['file' => ['File tidak memiliki baris data untuk diimpor.']]);
        }

        if ($dataRowCount > self::MAX_DATA_ROWS) {
            throw ApiException::validation(['file' => ['Jumlah baris data melebihi batas maksimal 300 baris.']]);
        }

        $expected = self::expectedHeaders($type);
        $normalizedRows = [];

        foreach ($rawRows as $rawRow) {
            $values = [];

            foreach ($expected as $column) {
                $index = $headerMap[$column];
                $values[$column] = trim((string) ($rawRow['cells'][$index] ?? ''));
            }

            $normalizedRows[] = [
                'row_number' => $rawRow['row_number'],
                'values' => $values,
            ];
        }

        return [
            'format' => $extension,
            'filename' => $this->sanitizeFilename($file->getClientOriginalName(), $extension),
            'rows' => $normalizedRows,
        ];
    }

    private function assertMagicBytes(string $path, string $extension): void
    {
        $handle = @fopen($path, 'rb');

        if ($handle === false) {
            throw ApiException::validation(['file' => ['File unggahan tidak dapat dibuka.']]);
        }

        try {
            $head = fread($handle, 8);
        } finally {
            fclose($handle);
        }

        if (! is_string($head)) {
            throw ApiException::validation(['file' => ['File unggahan tidak dapat dibaca.']]);
        }

        $isZip = str_starts_with($head, "PK\x03\x04");

        if ($extension === 'xlsx' && ! $isZip) {
            throw ApiException::validation(['file' => ['File .xlsx tidak memiliki signature ZIP/OOXML yang valid.']]);
        }

        if ($extension === 'csv' && ($isZip || str_starts_with($head, '%PDF') || str_contains($head, "\x00"))) {
            throw ApiException::validation(['file' => ['File .csv mengandung data biner yang tidak valid.']]);
        }
    }

    /**
     * @param  list<string>  $cells
     * @return array<string, int>
     */
    private function validateAndMapHeaders(array $cells, string $type): array
    {
        $expected = self::expectedHeaders($type);
        $normalized = [];

        foreach ($cells as $cell) {
            $normalized[] = mb_strtolower(trim($cell));
        }

        // Trim trailing empty header columns produced by trailing delimiters/cells.
        while ($normalized !== [] && end($normalized) === '') {
            array_pop($normalized);
        }

        if ($normalized === []) {
            throw ApiException::validation(['file' => ['Baris header file tidak ditemukan.']]);
        }

        $seen = [];
        $unknown = [];
        $map = [];

        foreach ($normalized as $index => $header) {
            if ($header === '') {
                throw ApiException::validation(['file' => ['Terdapat kolom header kosong pada baris pertama.']]);
            }

            if (isset($seen[$header])) {
                throw ApiException::validation(['file' => ["Kolom header duplikat ditemukan: {$header}."]]);
            }

            $seen[$header] = true;

            if (! in_array($header, $expected, true)) {
                $unknown[] = $header;
            } else {
                $map[$header] = $index;
            }
        }

        if ($unknown !== []) {
            throw ApiException::validation([
                'file' => ['Kolom template tidak sesuai untuk entitas '.$type.': kolom tidak dikenal ('.implode(', ', $unknown).').'],
            ]);
        }

        $missing = array_values(array_diff($expected, array_keys($map)));

        if ($missing !== []) {
            throw ApiException::validation([
                'file' => ['Kolom wajib template '.$type.' belum lengkap: '.implode(', ', $missing).'.'],
            ]);
        }

        return $map;
    }

    private function sanitizeFilename(string $original, string $extension): string
    {
        $base = preg_replace('/[^\p{L}\p{N}._-]+/u', '-', trim($original)) ?? '';
        $base = trim($base, '.-');

        if ($base === '') {
            $base = 'import.'.$extension;
        }

        return mb_substr($base, 0, 200);
    }
}
