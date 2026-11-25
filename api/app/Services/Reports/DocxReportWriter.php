<?php

namespace App\Services\Reports;

use RuntimeException;

/**
 * Pure-PHP OOXML WordprocessingML (.docx) report writer requiring zero optional PHP extensions (no ext-zip).
 * Produces a landscape A4 document compatible with Microsoft Word, Google Docs, and LibreOffice Writer.
 */
class DocxReportWriter
{
    private const TABLE_WIDTH_DXA = 15120;

    public function __construct(private PureZipWriter $zip = new PureZipWriter) {}

    /**
     * Build a .docx report and write it to the destination path, returning the data row count.
     *
     * @param  list<string>  $headers
     * @param  iterable<list<bool|float|int|string|null>>  $rows
     */
    public function writeToFile(string $outputPath, string $title, array $headers, iterable $rows): int
    {
        $docTmp = tempnam(sys_get_temp_dir(), 'ch_docx_');

        if ($docTmp === false) {
            throw new RuntimeException('Gagal membuat file sementara dokumen DOCX.');
        }

        try {
            $rowCount = $this->writeDocumentXml($docTmp, $title, $headers, $rows);
            $documentXml = file_get_contents($docTmp);

            if ($documentXml === false) {
                throw new RuntimeException('Gagal membaca document XML sementara.');
            }

            $this->zip->write($outputPath, [
                '[Content_Types].xml' => $this->contentTypesXml(),
                '_rels/.rels' => $this->rootRelsXml(),
                'word/document.xml' => $documentXml,
                'word/_rels/document.xml.rels' => $this->documentRelsXml(),
                'word/styles.xml' => $this->stylesXml(),
            ]);

            return $rowCount;
        } finally {
            @unlink($docTmp);
        }
    }

    /**
     * @param  list<string>  $headers
     * @param  iterable<list<bool|float|int|string|null>>  $rows
     */
    private function writeDocumentXml(string $docPath, string $title, array $headers, iterable $rows): int
    {
        $handle = fopen($docPath, 'wb');

        if ($handle === false) {
            throw new RuntimeException('Gagal membuka stream document XML.');
        }

        $colCount = max(1, count($headers));
        $colWidth = intdiv(self::TABLE_WIDTH_DXA, $colCount);
        $generatedAt = now()->utc()->format('Y-m-d H:i:s').' UTC';

        try {
            fwrite($handle, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'."\n");
            fwrite($handle, '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>');

            // Title & timestamp subtitle
            fwrite($handle, '<w:p><w:pPr><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="111827"/></w:rPr><w:t xml:space="preserve">'.$this->escapeXml($title).'</w:t></w:r></w:p>');
            fwrite($handle, '<w:p><w:pPr><w:spacing w:after="200"/></w:pPr><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="6B7280"/></w:rPr><w:t xml:space="preserve">Dibuat: '.$this->escapeXml($generatedAt).' · Console Hub</w:t></w:r></w:p>');

            // Table properties & grid
            fwrite($handle, '<w:tbl><w:tblPr>'
                .'<w:tblW w:w="'.self::TABLE_WIDTH_DXA.'" w:type="dxa"/>'
                .'<w:tblLayout w:type="fixed"/>'
                .'<w:tblBorders>'
                .'<w:top w:val="single" w:sz="4" w:space="0" w:color="D0D7DE"/>'
                .'<w:left w:val="single" w:sz="4" w:space="0" w:color="D0D7DE"/>'
                .'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="D0D7DE"/>'
                .'<w:right w:val="single" w:sz="4" w:space="0" w:color="D0D7DE"/>'
                .'<w:insideH w:val="single" w:sz="4" w:space="0" w:color="D0D7DE"/>'
                .'<w:insideV w:val="single" w:sz="4" w:space="0" w:color="D0D7DE"/>'
                .'</w:tblBorders>'
                .'<w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar>'
                .'</w:tblPr><w:tblGrid>');

            for ($i = 0; $i < $colCount; $i++) {
                fwrite($handle, '<w:gridCol w:w="'.$colWidth.'"/>');
            }
            fwrite($handle, '</w:tblGrid>');

            // Repeating header row
            fwrite($handle, $this->buildRowXml($headers, $colWidth, isHeader: true, shade: 'EEF2F7'));

            $rowCount = 0;
            foreach ($rows as $rowValues) {
                $rowCount++;
                $shade = ($rowCount % 2 === 0) ? 'FAFBFD' : null;
                fwrite($handle, $this->buildRowXml($rowValues, $colWidth, isHeader: false, shade: $shade));
            }

            if ($rowCount === 0) {
                fwrite($handle, '<w:tr><w:trPr><w:cantSplit/></w:trPr><w:tc><w:tcPr><w:gridSpan w:val="'.$colCount.'"/><w:tcW w:w="'.self::TABLE_WIDTH_DXA.'" w:type="dxa"/></w:tcPr>'
                    .'<w:p><w:r><w:rPr><w:i/><w:color w:val="6B7280"/></w:rPr><w:t>Tidak ada data yang cocok dengan filter.</w:t></w:r></w:p></w:tc></w:tr>');
            }

            fwrite($handle, '</w:tbl>');
            fwrite($handle, '<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="720" w:right="859" w:bottom="720" w:left="859" w:header="450" w:footer="450" w:gutter="0"/></w:sectPr>');
            fwrite($handle, '</w:body></w:document>');

            return $rowCount;
        } finally {
            fclose($handle);
        }
    }

    /**
     * @param  list<bool|float|int|string|null>  $values
     */
    private function buildRowXml(array $values, int $colWidth, bool $isHeader, ?string $shade): string
    {
        $trPr = $isHeader ? '<w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>' : '<w:trPr><w:cantSplit/></w:trPr>';
        $xml = '<w:tr>'.$trPr;

        foreach ($values as $value) {
            $text = $this->formatCellValue($value);
            $shd = $shade !== null ? '<w:shd w:val="clear" w:color="auto" w:fill="'.$shade.'"/>' : '';
            $rPr = $isHeader ? '<w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="111827"/></w:rPr>' : '<w:rPr><w:sz w:val="18"/><w:color w:val="1F2937"/></w:rPr>';

            $xml .= '<w:tc><w:tcPr><w:tcW w:w="'.$colWidth.'" w:type="dxa"/>'.$shd.'</w:tcPr>'
                .'<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r>'.$rPr
                .'<w:t xml:space="preserve">'.$this->escapeXml($text).'</w:t></w:r></w:p></w:tc>';
        }

        return $xml.'</w:tr>';
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

    private function escapeXml(string $value): string
    {
        $clean = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $value) ?? $value;

        return htmlspecialchars($clean, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }

    private function contentTypesXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            .'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            .'<Default Extension="xml" ContentType="application/xml"/>'
            .'<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            .'<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
            .'</Types>';
    }

    private function rootRelsXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            .'</Relationships>';
    }

    private function documentRelsXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            .'</Relationships>';
    }

    private function stylesXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            .'<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="18"/></w:rPr></w:rPrDefault></w:docDefaults>'
            .'<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
            .'</w:styles>';
    }
}
