<?php

namespace App\Services\Imports;

use App\Support\ApiException;
use SimpleXMLElement;

/**
 * Pure-PHP OOXML (.xlsx) worksheet reader requiring zero optional PHP extensions (no ext-zip).
 * Protects against XXE, Zip Bombs, sparse cell coordinates (e.g. A1, C1), sharedStrings, and inlineStr.
 */
class XlsxWorkbookReader
{
    public const MAX_DATA_ROWS = 300;

    private const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

    private const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

    public function __construct(private PureZipReader $zip = new PureZipReader) {}

    /**
     * Parse the first worksheet into non-empty trimmed rows indexed with their 1-based Excel row number.
     *
     * @return list<array{row_number: int, cells: list<string>}>
     */
    public function read(string $path): array
    {
        $entries = $this->zip->readFile($path);
        $sheetPath = $this->resolveFirstSheetPath($entries);

        if (! isset($entries[$sheetPath])) {
            throw ApiException::validation(['file' => ['Worksheet pertama (sheet1.xml) tidak ditemukan di file XLSX.']]);
        }

        $sharedStrings = isset($entries['xl/sharedStrings.xml'])
            ? $this->parseSharedStrings($entries['xl/sharedStrings.xml'])
            : [];

        return $this->parseWorksheet($entries[$sheetPath], $sharedStrings);
    }

    /**
     * @param  array<string, string>  $entries
     */
    private function resolveFirstSheetPath(array $entries): string
    {
        $default = 'xl/worksheets/sheet1.xml';

        if (! isset($entries['xl/workbook.xml'])) {
            return $default;
        }

        $workbook = $this->loadXml($entries['xl/workbook.xml']);
        $sheets = $workbook->children(self::MAIN_NS)->sheets->sheet ?? null;

        if ($sheets === null || count($sheets) === 0) {
            return $default;
        }

        $firstSheet = $sheets[0];
        $relAttrs = $firstSheet->attributes(self::REL_NS);
        $relId = $relAttrs !== null ? (string) ($relAttrs['id'] ?? '') : '';

        if ($relId === '' || ! isset($entries['xl/_rels/workbook.xml.rels'])) {
            return $default;
        }

        $rels = $this->loadXml($entries['xl/_rels/workbook.xml.rels']);

        foreach ($rels->Relationship as $rel) {
            $attrs = $rel->attributes();

            if ($attrs !== null && (string) ($attrs['Id'] ?? '') === $relId) {
                $target = ltrim((string) ($attrs['Target'] ?? ''), '/');

                if ($target === '') {
                    return $default;
                }

                return str_starts_with($target, 'xl/') ? $target : 'xl/'.$target;
            }
        }

        return $default;
    }

    /**
     * @return list<string>
     */
    private function parseSharedStrings(string $xml): array
    {
        $root = $this->loadXml($xml);
        $strings = [];

        foreach ($root->children(self::MAIN_NS)->si as $si) {
            $strings[] = $this->extractTextNode($si);
        }

        return $strings;
    }

    /**
     * @param  list<string>  $sharedStrings
     * @return list<array{row_number: int, cells: list<string>}>
     */
    private function parseWorksheet(string $xml, array $sharedStrings): array
    {
        $root = $this->loadXml($xml);
        $sheetData = $root->children(self::MAIN_NS)->sheetData;

        if ($sheetData->count() === 0) {
            return [];
        }

        $rows = [];
        $fallbackRowNumber = 0;

        foreach ($sheetData->row as $rowNode) {
            $fallbackRowNumber++;
            $rowAttrs = $rowNode->attributes();
            $rowNumber = ($rowAttrs !== null && isset($rowAttrs['r']) && ctype_digit((string) $rowAttrs['r']))
                ? (int) $rowAttrs['r']
                : $fallbackRowNumber;

            $cells = [];
            $nextCol = 0;

            foreach ($rowNode->c as $cellNode) {
                $cellAttrs = $cellNode->attributes();
                $ref = $cellAttrs !== null ? (string) ($cellAttrs['r'] ?? '') : '';
                $colIndex = $ref !== '' ? $this->columnIndexFromRef($ref, $nextCol) : $nextCol;

                while ($nextCol < $colIndex) {
                    $cells[$nextCol] = '';
                    $nextCol++;
                }

                $type = $cellAttrs !== null ? (string) ($cellAttrs['t'] ?? '') : '';
                $cells[$colIndex] = trim($this->extractCellValue($cellNode, $type, $sharedStrings));
                $nextCol = $colIndex + 1;
            }

            if (! $this->isRowEmpty($cells)) {
                $rows[] = [
                    'row_number' => $rowNumber,
                    'cells' => $this->reindexCells($cells),
                ];

                if (count($rows) > (self::MAX_DATA_ROWS + 1)) {
                    throw ApiException::validation(['file' => ['Jumlah baris data melebihi batas maksimal 300 baris.']]);
                }
            }
        }

        return $rows;
    }

    /**
     * @param  list<string>  $sharedStrings
     */
    private function extractCellValue(SimpleXMLElement $cellNode, string $type, array $sharedStrings): string
    {
        $children = $cellNode->children(self::MAIN_NS);

        return match ($type) {
            's' => $this->resolveSharedString((string) ($children->v ?? ''), $sharedStrings),
            'inlineStr' => isset($children->is) ? $this->extractTextNode($children->is) : '',
            'b' => ((string) ($children->v ?? '')) === '1' ? 'true' : (((string) ($children->v ?? '')) === '0' ? 'false' : ''),
            default => (string) ($children->v ?? ''),
        };
    }

    /**
     * @param  list<string>  $sharedStrings
     */
    private function resolveSharedString(string $rawIndex, array $sharedStrings): string
    {
        if (! ctype_digit(trim($rawIndex))) {
            return '';
        }

        return $sharedStrings[(int) trim($rawIndex)] ?? '';
    }

    private function extractTextNode(SimpleXMLElement $container): string
    {
        $children = $container->children(self::MAIN_NS);

        if (isset($children->t)) {
            return (string) $children->t;
        }

        if (! isset($children->r)) {
            return '';
        }

        $text = '';

        foreach ($children->r as $run) {
            $runChildren = $run->children(self::MAIN_NS);
            if (isset($runChildren->t)) {
                $text .= (string) $runChildren->t;
            }
        }

        return $text;
    }

    private function columnIndexFromRef(string $ref, int $fallback): int
    {
        if (preg_match('/^([A-Za-z]+)\d+$/', $ref, $matches) !== 1) {
            return $fallback;
        }

        $letters = strtoupper($matches[1]);
        $index = 0;
        $len = strlen($letters);

        for ($i = 0; $i < $len; $i++) {
            $index = ($index * 26) + (ord($letters[$i]) - 64);
        }

        return max(0, $index - 1);
    }

    /**
     * @param  array<int, string>  $cells
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

    /**
     * @param  array<int, string>  $cells
     * @return list<string>
     */
    private function reindexCells(array $cells): array
    {
        if ($cells === []) {
            return [];
        }

        $max = max(array_keys($cells));
        $result = [];

        for ($i = 0; $i <= $max; $i++) {
            $result[] = $cells[$i] ?? '';
        }

        return $result;
    }

    private function loadXml(string $xml): SimpleXMLElement
    {
        $upper = strtoupper($xml);

        if (str_contains($upper, '<!DOCTYPE') || str_contains($upper, '<!ENTITY')) {
            throw ApiException::validation(['file' => ['Dokumen XML di dalam file XLSX ditolak karena mengandung DTD/ENTITY.']]);
        }

        $previous = libxml_use_internal_errors(true);
        libxml_clear_errors();

        try {
            $element = simplexml_load_string($xml, SimpleXMLElement::class, LIBXML_NONET | LIBXML_NOCDATA);

            if (! $element instanceof SimpleXMLElement) {
                throw ApiException::validation(['file' => ['Struktur XML di dalam file XLSX tidak valid.']]);
            }

            return $element;
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
    }
}
