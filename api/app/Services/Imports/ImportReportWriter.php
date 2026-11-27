<?php

namespace App\Services\Imports;

use App\Models\DataImport;
use RuntimeException;

/**
 * Builds downloadable CSV reports for preview errors and execution results with formula-injection protection.
 */
class ImportReportWriter
{
    /**
     * Generate CSV bytes for `scope=all` or `scope=errors`.
     */
    public function buildCsv(DataImport $import, string $scope = 'all'): string
    {
        $headers = TabularFileReader::expectedHeaders($import->type);
        $sourceByRow = [];

        foreach ($import->source_rows ?? [] as $row) {
            $sourceByRow[(int) $row['row_number']] = $row['values'];
        }

        $rows = $this->collectRows($import, $scope);

        $handle = fopen('php://temp', 'r+b');

        if ($handle === false) {
            throw new RuntimeException('Gagal membuat stream CSV laporan impor.');
        }

        try {
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['row_number', ...$headers, 'status', 'action', 'target_id', 'reason'], ',', '"', '');

            foreach ($rows as $row) {
                $rowNumber = (int) ($row['row_number'] ?? 0);
                $values = $sourceByRow[$rowNumber] ?? (is_array($row['values'] ?? null) ? $row['values'] : []);
                $line = [(string) $rowNumber];

                foreach ($headers as $column) {
                    $line[] = $this->sanitizeCell((string) ($values[$column] ?? ''));
                }

                $line[] = $this->sanitizeCell((string) ($row['status'] ?? ''));
                $line[] = $this->sanitizeCell((string) ($row['action'] ?? ''));
                $line[] = $this->sanitizeCell((string) ($row['target_id'] ?? ''));
                $line[] = $this->sanitizeCell((string) ($row['reason'] ?? ''));

                fputcsv($handle, $line, ',', '"', '');
            }

            rewind($handle);

            return (string) stream_get_contents($handle);
        } finally {
            fclose($handle);
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function collectRows(DataImport $import, string $scope): array
    {
        $resultsByRow = [];

        foreach ($import->execution_results ?? [] as $result) {
            if (isset($result['row_number'])) {
                $resultsByRow[(int) $result['row_number']] = $result;
            }
        }

        $combined = [];

        if (is_array($import->plan_rows) && $import->plan_rows !== []) {
            foreach ($import->plan_rows as $plan) {
                $rowNumber = (int) ($plan['row_number'] ?? 0);

                if (isset($resultsByRow[$rowNumber])) {
                    $combined[] = $resultsByRow[$rowNumber];
                } else {
                    $action = (string) ($plan['action'] ?? '');
                    $combined[] = [
                        'row_number' => $rowNumber,
                        'values' => $plan['values'] ?? [],
                        'status' => $action === 'invalid' ? 'invalid' : ($import->status === DataImport::STATUS_PREVIEW ? $action : 'pending'),
                        'action' => $action,
                        'target_id' => $plan['target_id'] ?? null,
                        'reason' => $plan['reason'] ?? null,
                    ];
                }
            }
        } else {
            $combined = array_values($resultsByRow);
        }

        if ($scope !== 'errors') {
            return $combined;
        }

        return array_values(array_filter($combined, static function (array $row): bool {
            return in_array((string) ($row['status'] ?? ''), ['invalid', 'failed', 'conflict'], true)
                || (string) ($row['action'] ?? '') === 'invalid';
        }));
    }

    private function sanitizeCell(string $value): string
    {
        if ($value !== '' && preg_match('/^[=+\-@\t\r]/', $value) === 1) {
            return "'".$value;
        }

        return $value;
    }
}
