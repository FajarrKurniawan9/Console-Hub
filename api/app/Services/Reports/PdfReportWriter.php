<?php

namespace App\Services\Reports;

use RuntimeException;

/**
 * Pure-PHP PDF 1.4 tabular report writer requiring zero external libraries or optional PHP extensions.
 * Generates multi-page landscape A4 tables with repeating headers, wrapped cell text, and page numbers.
 */
class PdfReportWriter
{
    private const PAGE_WIDTH = 841.89;

    private const PAGE_HEIGHT = 595.28;

    private const MARGIN_X = 30.0;

    private const MARGIN_TOP = 36.0;

    private const MARGIN_BOTTOM = 42.0;

    private const FONT_SIZE_TITLE = 13.0;

    private const FONT_SIZE_META = 8.5;

    private const FONT_SIZE_CELL = 8.0;

    private const LINE_HEIGHT = 11.0;

    private const CELL_PADDING_X = 4.0;

    private const CELL_PADDING_Y = 4.0;

    private const MAX_CELL_LINES = 3;

    /**
     * Build a multi-page PDF 1.4 report and write it to the destination path, returning the data row count.
     *
     * @param  list<string>  $headers
     * @param  iterable<list<bool|float|int|string|null>>  $rows
     */
    public function writeToFile(string $outputPath, string $title, array $headers, iterable $rows): int
    {
        $colCount = max(1, count($headers));
        $usableWidth = self::PAGE_WIDTH - (2 * self::MARGIN_X);
        $colWidth = $usableWidth / $colCount;
        $generatedAt = now()->utc()->format('Y-m-d H:i:s').' UTC';

        /** @var list<string> $pages */
        $pages = [];
        $currentStream = '';
        $y = self::PAGE_HEIGHT - self::MARGIN_TOP;

        // First page title + subtitle
        $currentStream .= $this->textCmd('F2', self::FONT_SIZE_TITLE, self::MARGIN_X, $y, $title, '0.07 0.09 0.15');
        $y -= 16.0;
        $currentStream .= $this->textCmd('F1', self::FONT_SIZE_META, self::MARGIN_X, $y, "Dibuat: {$generatedAt} - Console Hub", '0.42 0.45 0.50');
        $y -= 14.0;

        [$headerStream, $headerHeight] = $this->renderRow($headers, $colWidth, $y, isHeader: true, fillRgb: '0.93 0.95 0.97');
        $currentStream .= $headerStream;
        $y -= $headerHeight;

        $rowCount = 0;

        foreach ($rows as $rowValues) {
            $rowCount++;
            $stringCells = array_map(fn (bool|float|int|string|null $v) => $this->formatCellValue($v), $rowValues);
            $neededHeight = $this->measureRowHeight($stringCells, $colWidth);

            if (($y - $neededHeight) < self::MARGIN_BOTTOM) {
                $pages[] = $currentStream;
                $currentStream = '';
                $y = self::PAGE_HEIGHT - self::MARGIN_TOP;

                [$repeatHeader, $repeatHeight] = $this->renderRow($headers, $colWidth, $y, isHeader: true, fillRgb: '0.93 0.95 0.97');
                $currentStream .= $repeatHeader;
                $y -= $repeatHeight;
            }

            $fillRgb = ($rowCount % 2 === 0) ? '0.98 0.98 0.99' : null;
            [$rowStream, $rowHeight] = $this->renderRow($stringCells, $colWidth, $y, isHeader: false, fillRgb: $fillRgb);
            $currentStream .= $rowStream;
            $y -= $rowHeight;
        }

        if ($rowCount === 0) {
            $currentStream .= $this->textCmd('F1', self::FONT_SIZE_CELL, self::MARGIN_X + 4.0, $y - 14.0, 'Tidak ada data yang cocok dengan filter.', '0.42 0.45 0.50');
        }

        $pages[] = $currentStream;

        $totalPages = count($pages);
        foreach ($pages as $index => $stream) {
            $pageNum = $index + 1;
            $footer = "Console Hub - Halaman {$pageNum} / {$totalPages}";
            $pages[$index] = $stream.$this->textCmd('F1', 8.0, self::MARGIN_X, 20.0, $footer, '0.42 0.45 0.50');
        }

        $this->writePdfDocument($outputPath, $pages);

        return $rowCount;
    }

    /**
     * @param  list<string>  $cells
     * @return array{0: string, 1: float}
     */
    private function renderRow(array $cells, float $colWidth, float $topY, bool $isHeader, ?string $fillRgb): array
    {
        $wrappedCols = array_map(fn (string $text) => $this->wrapText($text, $colWidth - (2 * self::CELL_PADDING_X)), $cells);
        $maxLines = max(1, ...array_map('count', $wrappedCols));
        $rowHeight = ($maxLines * self::LINE_HEIGHT) + (2 * self::CELL_PADDING_Y);
        $bottomY = $topY - $rowHeight;
        $tableWidth = $colWidth * count($cells);

        $stream = '';

        if ($fillRgb !== null) {
            $stream .= sprintf("%s rg %.2f %.2f %.2f %.2f re f\n", $fillRgb, self::MARGIN_X, $bottomY, $tableWidth, $rowHeight);
        }

        $stream .= "0.82 0.85 0.88 RG 0.5 w\n";
        $stream .= sprintf("%.2f %.2f %.2f %.2f re S\n", self::MARGIN_X, $bottomY, $tableWidth, $rowHeight);

        $font = $isHeader ? 'F2' : 'F1';
        $color = $isHeader ? '0.07 0.09 0.15' : '0.12 0.16 0.22';

        foreach ($wrappedCols as $colIdx => $lines) {
            $cellX = self::MARGIN_X + ($colIdx * $colWidth);

            if ($colIdx > 0) {
                $stream .= sprintf("%.2f %.2f m %.2f %.2f l S\n", $cellX, $bottomY, $cellX, $topY);
            }

            foreach ($lines as $lineIdx => $line) {
                $textY = $topY - self::CELL_PADDING_Y - self::FONT_SIZE_CELL - ($lineIdx * self::LINE_HEIGHT);
                $stream .= $this->textCmd($font, self::FONT_SIZE_CELL, $cellX + self::CELL_PADDING_X, $textY, $line, $color);
            }
        }

        return [$stream, $rowHeight];
    }

    /**
     * @param  list<string>  $cells
     */
    private function measureRowHeight(array $cells, float $colWidth): float
    {
        $maxLines = 1;
        $innerWidth = $colWidth - (2 * self::CELL_PADDING_X);

        foreach ($cells as $text) {
            $lines = count($this->wrapText($text, $innerWidth));
            if ($lines > $maxLines) {
                $maxLines = $lines;
            }
        }

        return ($maxLines * self::LINE_HEIGHT) + (2 * self::CELL_PADDING_Y);
    }

    /**
     * Wrap text conservatively for Helvetica 8pt (avg glyph width ~4.5pt) within the column width.
     *
     * @return list<string>
     */
    private function wrapText(string $text, float $maxWidthPt): array
    {
        $normalized = preg_replace('/\s+/', ' ', trim($text)) ?? '';

        if ($normalized === '') {
            return [''];
        }

        $maxChars = max(6, (int) floor($maxWidthPt / 4.6));
        $words = explode(' ', $normalized);
        $lines = [];
        $current = '';

        foreach ($words as $word) {
            $candidate = $current === '' ? $word : $current.' '.$word;

            if (mb_strlen($candidate) <= $maxChars) {
                $current = $candidate;

                continue;
            }

            if ($current !== '') {
                $lines[] = $current;
            }

            if (mb_strlen($word) > $maxChars) {
                $chunks = mb_str_split($word, $maxChars);
                $lastChunk = array_pop($chunks);
                foreach ($chunks as $chunk) {
                    $lines[] = $chunk;
                }
                $current = $lastChunk;
            } else {
                $current = $word;
            }

            if (count($lines) >= self::MAX_CELL_LINES) {
                break;
            }
        }

        if ($current !== '' && count($lines) < self::MAX_CELL_LINES) {
            $lines[] = $current;
        }

        if (count($lines) > self::MAX_CELL_LINES) {
            $lines = array_slice($lines, 0, self::MAX_CELL_LINES);
        }

        // Add ellipsis if content exceeded MAX_CELL_LINES
        $joined = implode(' ', $lines);
        if (mb_strlen($joined) < mb_strlen($normalized)) {
            $lastIdx = count($lines) - 1;
            $lines[$lastIdx] = mb_substr($lines[$lastIdx], 0, max(1, $maxChars - 3)).'...';
        }

        return $lines;
    }

    private function textCmd(string $font, float $size, float $x, float $y, string $text, string $rgb): string
    {
        return sprintf(
            "BT %s rg /%s %.2f Tf %.2f %.2f Td (%s) Tj ET\n",
            $rgb,
            $font,
            $size,
            $x,
            $y,
            $this->encodePdfString($text),
        );
    }

    private function formatCellValue(bool|float|int|string|null $value): string
    {
        if ($value === null) {
            return '';
        }

        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }

        return (string) $value;
    }

    /**
     * Normalize UTF-8 text into WinAnsiEncoding and escape PDF string delimiters.
     */
    private function encodePdfString(string $text): string
    {
        $replaced = str_replace(
            ['·', '—', '–', '…', '“', '”', '‘', '’'],
            ['-', '-', '-', '...', '"', '"', "'", "'"],
            $text,
        );

        $encoded = function_exists('iconv')
            ? (@iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $replaced) ?: '')
            : '';

        if ($encoded === '') {
            $encoded = preg_replace('/[^\x20-\x7E]/', ' ', $replaced) ?? '';
        }

        $clean = preg_replace('/[\x00-\x1F\x7F]/', ' ', $encoded) ?? '';

        return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $clean);
    }

    /**
     * Assemble a valid PDF 1.4 file with exact xref byte offsets.
     *
     * @param  list<string>  $pageStreams
     */
    private function writePdfDocument(string $outputPath, array $pageStreams): void
    {
        $handle = fopen($outputPath, 'wb');

        if ($handle === false) {
            throw new RuntimeException('Gagal membuka file output PDF.');
        }

        try {
            $pageObjectIds = [];
            /** @var array<int, string> $objects */
            $objects = [
                1 => '<< /Type /Catalog /Pages 2 0 R >>',
                2 => '', // filled after page IDs are assigned
                3 => '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
                4 => '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
            ];

            $nextId = 5;
            foreach ($pageStreams as $stream) {
                $contentId = $nextId++;
                $pageId = $nextId++;

                $objects[$contentId] = sprintf("<< /Length %d >>\nstream\n%sendstream", strlen($stream), $stream);
                $objects[$pageId] = sprintf(
                    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2f %.2f] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents %d 0 R >>',
                    self::PAGE_WIDTH,
                    self::PAGE_HEIGHT,
                    $contentId,
                );
                $pageObjectIds[] = $pageId;
            }

            $kids = implode(' ', array_map(fn (int $id) => "{$id} 0 R", $pageObjectIds));
            $objects[2] = sprintf('<< /Type /Pages /Kids [%s] /Count %d >>', $kids, count($pageObjectIds));

            ksort($objects);

            $header = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
            fwrite($handle, $header);
            $offset = strlen($header);

            /** @var array<int, int> $offsets */
            $offsets = [];
            foreach ($objects as $id => $body) {
                $offsets[$id] = $offset;
                $entry = "{$id} 0 obj\n{$body}\nendobj\n";
                fwrite($handle, $entry);
                $offset += strlen($entry);
            }

            $xrefOffset = $offset;
            $count = count($objects) + 1;
            fwrite($handle, "xref\n0 {$count}\n");
            fwrite($handle, "0000000000 65535 f \n");

            for ($id = 1; $id <= count($objects); $id++) {
                fwrite($handle, sprintf("%010d 00000 n \n", $offsets[$id]));
            }

            fwrite($handle, "trailer\n<< /Size {$count} /Root 1 0 R >>\nstartxref\n{$xrefOffset}\n%%EOF\n");
        } finally {
            fclose($handle);
        }
    }
}
