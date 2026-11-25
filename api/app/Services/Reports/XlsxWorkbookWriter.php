<?php

namespace App\Services\Reports;

use RuntimeException;

/**
 * Pure-PHP OOXML (.xlsx) workbook writer requiring zero optional PHP extensions (no ext-zip or ext-xmlwriter).
 * Uses standard PHP crc32 + optional zlib gzdeflate (falls back to ZIP STORE method 0 if zlib is unavailable).
 */
class XlsxWorkbookWriter
{
    /**
     * Build an .xlsx workbook and write it to the given destination file path, returning the data row count.
     *
     * @param  list<string>  $headers
     * @param  iterable<list<bool|float|int|string|null>>  $rows
     */
    public function writeToFile(string $outputPath, array $headers, iterable $rows, string $sheetName = 'Laporan'): int
    {
        $sheetTmp = tempnam(sys_get_temp_dir(), 'ch_sheet_');

        if ($sheetTmp === false) {
            throw new RuntimeException('Gagal membuat file sementara worksheet XLSX.');
        }

        try {
            $rowCount = $this->writeWorksheetXml($sheetTmp, $headers, $rows);
            $sheetXml = file_get_contents($sheetTmp);

            if ($sheetXml === false) {
                throw new RuntimeException('Gagal membaca worksheet XML sementara.');
            }

            $entries = [
                '[Content_Types].xml' => $this->contentTypesXml(),
                '_rels/.rels' => $this->rootRelsXml(),
                'xl/workbook.xml' => $this->workbookXml($sheetName),
                'xl/_rels/workbook.xml.rels' => $this->workbookRelsXml(),
                'xl/styles.xml' => $this->stylesXml(),
                'xl/worksheets/sheet1.xml' => $sheetXml,
            ];

            $this->writeZipArchive($outputPath, $entries);

            return $rowCount;
        } finally {
            @unlink($sheetTmp);
        }
    }

    /**
     * @param  list<string>  $headers
     * @param  iterable<list<bool|float|int|string|null>>  $rows
     */
    private function writeWorksheetXml(string $sheetPath, array $headers, iterable $rows): int
    {
        $handle = fopen($sheetPath, 'wb');

        if ($handle === false) {
            throw new RuntimeException('Gagal membuka stream worksheet XLSX.');
        }

        try {
            fwrite($handle, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'."\n");
            fwrite($handle, '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>');

            fwrite($handle, $this->buildRowXml(1, $headers, isHeader: true));

            $rowCount = 0;

            foreach ($rows as $rowValues) {
                $rowCount++;
                fwrite($handle, $this->buildRowXml($rowCount + 1, $rowValues, isHeader: false));
            }

            fwrite($handle, '</sheetData></worksheet>');

            return $rowCount;
        } finally {
            fclose($handle);
        }
    }

    /**
     * @param  list<bool|float|int|string|null>  $values
     */
    private function buildRowXml(int $rowIndex, array $values, bool $isHeader): string
    {
        $xml = '<row r="'.$rowIndex.'">';

        foreach ($values as $colIndex => $value) {
            if ($value === null) {
                continue;
            }

            $ref = $this->columnLetter($colIndex).$rowIndex;
            $style = $isHeader ? ' s="1"' : '';

            if (! $isHeader && (is_int($value) || (is_float($value) && is_finite($value)))) {
                $xml .= '<c r="'.$ref.'"'.$style.'><v>'.$value.'</v></c>';

                continue;
            }

            if (! $isHeader && is_bool($value)) {
                $xml .= '<c r="'.$ref.'" t="b"'.$style.'><v>'.($value ? '1' : '0').'</v></c>';

                continue;
            }

            $escaped = $this->escapeXml((string) $value);
            $xml .= '<c r="'.$ref.'" t="inlineStr"'.$style.'><is><t xml:space="preserve">'.$escaped.'</t></is></c>';
        }

        return $xml.'</row>';
    }

    /**
     * Convert 0-based column index to Excel column letters (0 => A, 25 => Z, 26 => AA).
     */
    private function columnLetter(int $index): string
    {
        $letters = '';
        $n = $index + 1;

        while ($n > 0) {
            $rem = ($n - 1) % 26;
            $letters = chr(65 + $rem).$letters;
            $n = intdiv($n - 1, 26);
        }

        return $letters;
    }

    /**
     * Strip illegal XML 1.0 control characters and escape XML entities.
     */
    private function escapeXml(string $value): string
    {
        $clean = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $value) ?? $value;

        return htmlspecialchars($clean, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }

    /**
     * @param  array<string, string>  $entries  archive path => raw uncompressed content
     */
    private function writeZipArchive(string $outputPath, array $entries): void
    {
        $handle = fopen($outputPath, 'wb');

        if ($handle === false) {
            throw new RuntimeException('Gagal membuka file output XLSX.');
        }

        $canDeflate = function_exists('gzdeflate');
        $dosTime = 0;
        $dosDate = (46 << 9) | (1 << 5) | 1; // 2026-01-01
        $centralDir = '';
        $offset = 0;
        $entryCount = 0;

        try {
            foreach ($entries as $name => $content) {
                $uncompressedSize = strlen($content);
                $crc = crc32($content);

                if ($canDeflate) {
                    $compressed = gzdeflate($content, 6);
                    if ($compressed === false) {
                        throw new RuntimeException("Gagal mengompresi entri XLSX: {$name}");
                    }
                    $method = 8;
                } else {
                    $compressed = $content;
                    $method = 0;
                }

                $compressedSize = strlen($compressed);
                $nameLength = strlen($name);

                $localHeader = pack(
                    'VvvvvvVVVvv',
                    0x04034B50,
                    20,
                    0x0800,
                    $method,
                    $dosTime,
                    $dosDate,
                    $crc,
                    $compressedSize,
                    $uncompressedSize,
                    $nameLength,
                    0,
                ).$name;

                fwrite($handle, $localHeader);
                fwrite($handle, $compressed);

                $centralDir .= pack(
                    'VvvvvvvVVVvvvvvVV',
                    0x02014B50,
                    20,
                    20,
                    0x0800,
                    $method,
                    $dosTime,
                    $dosDate,
                    $crc,
                    $compressedSize,
                    $uncompressedSize,
                    $nameLength,
                    0,
                    0,
                    0,
                    0,
                    0,
                    $offset,
                ).$name;

                $offset += strlen($localHeader) + $compressedSize;
                $entryCount++;
            }

            $endOfCentralDir = pack(
                'VvvvvVVv',
                0x06054B50,
                0,
                0,
                $entryCount,
                $entryCount,
                strlen($centralDir),
                $offset,
                0,
            );

            fwrite($handle, $centralDir);
            fwrite($handle, $endOfCentralDir);
        } finally {
            fclose($handle);
        }
    }

    private function contentTypesXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            .'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            .'<Default Extension="xml" ContentType="application/xml"/>'
            .'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            .'<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            .'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            .'</Types>';
    }

    private function rootRelsXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            .'</Relationships>';
    }

    private function workbookXml(string $sheetName): string
    {
        $safeName = mb_substr(preg_replace('/[\\\\\/?*\[\]:]/', '', $sheetName) ?: 'Laporan', 0, 31);

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            .'<sheets><sheet name="'.$this->escapeXml($safeName).'" sheetId="1" r:id="rId1"/></sheets>'
            .'</workbook>';
    }

    private function workbookRelsXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            .'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            .'</Relationships>';
    }

    private function stylesXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            .'<fonts count="2">'
            .'<font><sz val="11"/><name val="Calibri"/></font>'
            .'<font><b/><sz val="11"/><name val="Calibri"/></font>'
            .'</fonts>'
            .'<fills count="2">'
            .'<fill><patternFill patternType="none"/></fill>'
            .'<fill><patternFill patternType="gray125"/></fill>'
            .'</fills>'
            .'<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
            .'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            .'<cellXfs count="2">'
            .'<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
            .'<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
            .'</cellXfs>'
            .'</styleSheet>';
    }
}
