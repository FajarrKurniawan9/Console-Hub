<?php

namespace App\Services\Reports;

use RuntimeException;

/**
 * Pure-PHP PKZIP 2.0 archive writer requiring zero optional PHP extensions (no ext-zip).
 * Uses standard PHP crc32 + optional zlib gzdeflate (falls back to STORE method 0 when zlib is absent).
 */
class PureZipWriter
{
    /**
     * @param  array<string, string>  $entries  archive path => uncompressed contents
     */
    public function write(string $outputPath, array $entries): void
    {
        $handle = fopen($outputPath, 'wb');

        if ($handle === false) {
            throw new RuntimeException('Gagal membuka file output arsip.');
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
                        throw new RuntimeException("Gagal mengompresi entri arsip: {$name}");
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
}
