<?php

namespace App\Services\Imports;

use App\Models\DataImport;
use App\Services\Reports\ReportFileWriter;
use App\Services\Reports\XlsxWorkbookWriter;
use InvalidArgumentException;
use RuntimeException;

/**
 * Generates official import templates (CSV / XLSX) with strict headers and one realistic example row.
 */
class ImportTemplateBuilder
{
    public function __construct(
        private XlsxWorkbookWriter $xlsx = new XlsxWorkbookWriter,
    ) {}

    /**
     * Build template binary content and return [filename, contentType, bytes].
     *
     * @return array{filename: string, content_type: string, content: string}
     */
    public function build(string $type, string $format): array
    {
        if (! in_array($type, DataImport::TYPES, true)) {
            throw new InvalidArgumentException("Entitas impor tidak dikenal: {$type}");
        }

        if (! in_array($format, DataImport::FORMATS, true)) {
            throw new InvalidArgumentException("Format template tidak didukung: {$format}");
        }

        $headers = TabularFileReader::expectedHeaders($type);
        $sample = $this->sampleRow($type);
        $filename = "template-import-{$type}.{$format}";
        $contentType = ReportFileWriter::mimeTypeFor($format);

        $content = $format === 'xlsx'
            ? $this->buildXlsx($headers, $sample, ucfirst($type))
            : $this->buildCsv($headers, $sample);

        return [
            'filename' => $filename,
            'content_type' => $contentType,
            'content' => $content,
        ];
    }

    /**
     * @return list<int|string>
     */
    private function sampleRow(string $type): array
    {
        return match ($type) {
            DataImport::TYPE_USERS => ['Budi Santoso', 'budi.santoso@example.com', 'user'],
            DataImport::TYPE_PERSONEL => ['', 'Sari Wulandari', 'Kurir'],
            DataImport::TYPE_PRODUKSI => ['', 'Area Tekstil A', 'Tenun', 'Sari Wulandari · Kurir'],
            DataImport::TYPE_BARANG => ['', 'Kain Katun', 'kain', 'Area Tekstil A · Tenun', 'Sari Wulandari', 50, 'm'],
            default => throw new InvalidArgumentException("Entitas impor tidak dikenal: {$type}"),
        };
    }

    /**
     * @param  list<string>  $headers
     * @param  list<int|string>  $sample
     */
    private function buildCsv(array $headers, array $sample): string
    {
        $handle = fopen('php://temp', 'r+b');

        if ($handle === false) {
            throw new RuntimeException('Gagal membuat stream CSV template.');
        }

        try {
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, $headers, ',', '"', '');
            fputcsv($handle, array_map(static fn (int|string $v): string => (string) $v, $sample), ',', '"', '');
            rewind($handle);

            return (string) stream_get_contents($handle);
        } finally {
            fclose($handle);
        }
    }

    /**
     * @param  list<string>  $headers
     * @param  list<int|string>  $sample
     */
    private function buildXlsx(array $headers, array $sample, string $sheetName): string
    {
        $tmpPath = tempnam(sys_get_temp_dir(), 'ch_imp_tpl_');

        if ($tmpPath === false) {
            throw new RuntimeException('Gagal membuat file sementara template XLSX.');
        }

        try {
            $this->xlsx->writeToFile($tmpPath, $headers, [$sample], "Template {$sheetName}");
            $bytes = file_get_contents($tmpPath);

            if (! is_string($bytes)) {
                throw new RuntimeException('Gagal membaca file sementara template XLSX.');
            }

            return $bytes;
        } finally {
            @unlink($tmpPath);
        }
    }
}
