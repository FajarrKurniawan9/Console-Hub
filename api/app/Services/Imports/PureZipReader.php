<?php

namespace App\Services\Imports;

use App\Support\ApiException;

/**
 * Pure-PHP PKZIP reader requiring zero optional PHP extensions (no ext-zip).
 * Protects against zip bombs and path traversal when reading user-uploaded .xlsx archives.
 */
class PureZipReader
{
    public const MAX_ARCHIVE_BYTES = 2_097_152; // 2 MB

    public const MAX_UNCOMPRESSED_BYTES = 10_485_760; // 10 MB

    public const MAX_ENTRIES = 50;

    private const EOCD_SIGNATURE = "\x50\x4b\x05\x06";

    private const CENTRAL_SIGNATURE = 0x02014B50;

    private const LOCAL_SIGNATURE = 0x04034B50;

    /**
     * Read entries from a ZIP file on disk and return an associative map of normalized path => contents.
     *
     * @param  list<string>|null  $onlyPaths
     * @return array<string, string>
     */
    public function readFile(string $path, ?array $onlyPaths = null): array
    {
        $binary = @file_get_contents($path);

        if (! is_string($binary) || $binary === '') {
            throw ApiException::validation(['file' => ['File XLSX tidak dapat dibaca atau kosong.']]);
        }

        return $this->readBinary($binary, $onlyPaths);
    }

    /**
     * Read entries from raw PKZIP bytes with Zip Bomb and traversal safeguards.
     *
     * @param  list<string>|null  $onlyPaths
     * @return array<string, string>
     */
    public function readBinary(string $binary, ?array $onlyPaths = null): array
    {
        $length = strlen($binary);

        if ($length > self::MAX_ARCHIVE_BYTES) {
            throw ApiException::validation(['file' => ['Ukuran file XLSX melebihi batas maksimal 2 MB.']]);
        }

        if ($length < 22 || ! str_starts_with($binary, "PK\x03\x04")) {
            throw ApiException::validation(['file' => ['File bukan arsip XLSX/ZIP yang valid.']]);
        }

        $eocdOffset = $this->findEocdOffset($binary);
        $eocd = unpack('Vsig/vdisk/vcdDisk/vdiskEntries/vtotalEntries/VcdSize/VcdOffset/vcommentLen', substr($binary, $eocdOffset, 22));

        if ($eocd === false || $eocd['disk'] !== 0 || $eocd['cdDisk'] !== 0 || $eocd['diskEntries'] !== $eocd['totalEntries']) {
            throw ApiException::validation(['file' => ['Struktur arsip XLSX tidak didukung (multi-disk tidak valid).']]);
        }

        $totalEntries = (int) $eocd['totalEntries'];

        if ($totalEntries === 0 || $totalEntries > self::MAX_ENTRIES) {
            throw ApiException::validation(['file' => ['Jumlah entri di dalam file XLSX tidak valid atau melebihi batas keamanan (maks 50 entri).']]);
        }

        $cdOffset = (int) $eocd['cdOffset'];
        $cdSize = (int) $eocd['cdSize'];

        if ($cdOffset < 0 || $cdSize < 0 || ($cdOffset + $cdSize) > $eocdOffset) {
            throw ApiException::validation(['file' => ['Direktori arsip XLSX rusak atau tidak konsisten.']]);
        }

        $wanted = $onlyPaths === null ? null : array_fill_keys(array_map([$this, 'normalizeEntryName'], $onlyPaths), true);
        $entries = [];
        $cursor = $cdOffset;
        $totalUncompressed = 0;

        for ($i = 0; $i < $totalEntries; $i++) {
            if (($cursor + 46) > ($cdOffset + $cdSize)) {
                throw ApiException::validation(['file' => ['Entri direktori arsip XLSX terpotong.']]);
            }

            $header = unpack(
                'Vsig/vverMade/vverNeed/vflags/vmethod/vmtime/vmdate/Vcrc/VcompSize/VuncompSize/vnameLen/vextraLen/vcommentLen/vdiskStart/vintAttr/VextAttr/VlocalOffset',
                substr($binary, $cursor, 46),
            );

            if ($header === false || (int) $header['sig'] !== self::CENTRAL_SIGNATURE) {
                throw ApiException::validation(['file' => ['Signature entri arsip XLSX tidak valid.']]);
            }

            $nameLen = (int) $header['nameLen'];
            $extraLen = (int) $header['extraLen'];
            $commentLen = (int) $header['commentLen'];
            $recordEnd = $cursor + 46 + $nameLen + $extraLen + $commentLen;

            if ($recordEnd > ($cdOffset + $cdSize)) {
                throw ApiException::validation(['file' => ['Metadata entri arsip XLSX terpotong.']]);
            }

            $rawName = substr($binary, $cursor + 46, $nameLen);
            $cursor = $recordEnd;

            $name = $this->normalizeEntryName($rawName);

            if (str_ends_with($rawName, '/')) {
                continue;
            }

            $declaredUncompressed = (int) $header['uncompSize'];
            $compressedSize = (int) $header['compSize'];

            if ($declaredUncompressed < 0 || $compressedSize < 0 || $declaredUncompressed > self::MAX_UNCOMPRESSED_BYTES) {
                throw ApiException::validation(['file' => ['Ukuran isi file XLSX melebihi batas keamanan (Zip Bomb guard).']]);
            }

            $totalUncompressed += $declaredUncompressed;

            if ($totalUncompressed > self::MAX_UNCOMPRESSED_BYTES) {
                throw ApiException::validation(['file' => ['Total ukuran uncompressed file XLSX melebihi batas 10 MB.']]);
            }

            if ($wanted !== null && ! isset($wanted[$name])) {
                continue;
            }

            $entries[$name] = $this->extractEntry(
                $binary,
                (int) $header['localOffset'],
                (int) $header['method'],
                $compressedSize,
                $declaredUncompressed,
                (int) $header['crc'],
                $eocdOffset,
            );
        }

        return $entries;
    }

    private function findEocdOffset(string $binary): int
    {
        $length = strlen($binary);
        $searchStart = max(0, $length - 65_557);
        $tail = substr($binary, $searchStart);
        $pos = strrpos($tail, self::EOCD_SIGNATURE);

        if ($pos === false) {
            throw ApiException::validation(['file' => ['Signature akhir arsip XLSX (EOCD) tidak ditemukan.']]);
        }

        $offset = $searchStart + $pos;

        if (($offset + 22) > $length) {
            throw ApiException::validation(['file' => ['Header EOCD XLSX tidak lengkap.']]);
        }

        return $offset;
    }

    private function normalizeEntryName(string $name): string
    {
        if ($name === '' || str_contains($name, "\x00") || str_contains($name, '\\') || str_starts_with($name, '/')) {
            throw ApiException::validation(['file' => ['Path internal file XLSX tidak valid (path traversal ditolak).']]);
        }

        $trimmed = trim($name, '/');
        $segments = explode('/', $trimmed);

        foreach ($segments as $segment) {
            if ($segment === '..' || $segment === '.') {
                throw ApiException::validation(['file' => ['Path internal file XLSX mengandung traversal yang ditolak.']]);
            }
        }

        return $trimmed;
    }

    private function extractEntry(
        string $binary,
        int $localOffset,
        int $method,
        int $compressedSize,
        int $declaredUncompressed,
        int $expectedCrc,
        int $eocdOffset,
    ): string {
        if ($localOffset < 0 || ($localOffset + 30) > $eocdOffset) {
            throw ApiException::validation(['file' => ['Offset lokal entri XLSX tidak valid.']]);
        }

        $local = unpack('Vsig/vver/vflags/vmethod/vmtime/vmdate/Vcrc/Vcomp/Vuncomp/vnameLen/vextraLen', substr($binary, $localOffset, 30));

        if ($local === false || (int) $local['sig'] !== self::LOCAL_SIGNATURE) {
            throw ApiException::validation(['file' => ['Local header entri XLSX tidak valid.']]);
        }

        $dataOffset = $localOffset + 30 + (int) $local['nameLen'] + (int) $local['extraLen'];

        if ($dataOffset < 0 || ($dataOffset + $compressedSize) > $eocdOffset) {
            throw ApiException::validation(['file' => ['Data terkompresi di dalam file XLSX terpotong.']]);
        }

        $payload = substr($binary, $dataOffset, $compressedSize);

        $content = match ($method) {
            0 => $payload,
            8 => $this->inflateBounded($payload),
            default => throw ApiException::validation(['file' => ["Metode kompresi ZIP ({$method}) di XLSX tidak didukung."]]),
        };

        if (strlen($content) !== $declaredUncompressed || strlen($content) > self::MAX_UNCOMPRESSED_BYTES) {
            throw ApiException::validation(['file' => ['Ukuran aktual data XLSX tidak cocok atau melebihi batas keamanan.']]);
        }

        $actualCrc = crc32($content) & 0xFFFFFFFF;
        $targetCrc = $expectedCrc & 0xFFFFFFFF;

        if ($actualCrc !== $targetCrc) {
            throw ApiException::validation(['file' => ['Checksum CRC32 entri XLSX tidak cocok (file korup).']]);
        }

        return $content;
    }

    private function inflateBounded(string $compressed): string
    {
        if ($compressed === '') {
            return '';
        }

        if (! function_exists('gzinflate')) {
            throw ApiException::validation(['file' => ['Ekstensi zlib tidak tersedia untuk membaca file XLSX terkompresi.']]);
        }

        $inflated = @gzinflate($compressed, self::MAX_UNCOMPRESSED_BYTES + 1);

        if (! is_string($inflated) || strlen($inflated) > self::MAX_UNCOMPRESSED_BYTES) {
            throw ApiException::validation(['file' => ['Gagal mendekompresi isi file XLSX atau ukuran melebihi batas keamanan.']]);
        }

        return $inflated;
    }
}
