<?php

use App\Services\Reports\ReportFileWriter;
use Illuminate\Support\Facades\Storage;

it('writes CSV with UTF-8 BOM and neutralizes formula injection cells', function () {
    Storage::fake('local');

    $writer = new ReportFileWriter;
    $count = $writer->write(
        'local',
        'exports/test.csv',
        'csv',
        ['id' => 'ID', 'name' => 'Nama', 'note' => 'Catatan'],
        (function () {
            yield ['id' => 1, 'name' => '=HYPERLINK("http://evil")', 'note' => '+123'];
            yield ['id' => 2, 'name' => '-drop', 'note' => '@cmd'];
            yield ['id' => 3, 'name' => 'Normal', 'note' => null];
        })(),
    );

    expect($count)->toBe(3);

    $content = Storage::disk('local')->get('exports/test.csv');
    expect($content)->not->toBeNull()
        ->and(str_starts_with((string) $content, "\xEF\xBB\xBF"))->toBeTrue()
        ->and((string) $content)->toContain("'=HYPERLINK")
        ->and((string) $content)->toContain("'+123")
        ->and((string) $content)->toContain("'-drop")
        ->and((string) $content)->toContain("'@cmd")
        ->and((string) $content)->toContain('Normal');
});

it('writes valid JSON array files', function () {
    Storage::fake('local');

    $writer = new ReportFileWriter;
    $count = $writer->write(
        'local',
        'exports/test.json',
        'json',
        ['id' => 'ID', 'name' => 'Nama'],
        [['id' => 10, 'name' => 'Kain Katun']],
    );

    expect($count)->toBe(1);

    $decoded = json_decode((string) Storage::disk('local')->get('exports/test.json'), true, 512, JSON_THROW_ON_ERROR);
    expect($decoded)->toBe([['id' => 10, 'name' => 'Kain Katun']]);
});

it('writes valid pure-PHP XLSX workbooks with strict ZIP integrity and well-formed XML', function () {
    Storage::fake('local');

    $writer = new ReportFileWriter;
    $count = $writer->write(
        'local',
        'exports/test.xlsx',
        'xlsx',
        ['id' => 'ID', 'name' => 'Nama & Deskripsi', 'qty' => 'Jumlah'],
        [
            ['id' => 'i-1', 'name' => "Kain <Linen> & \"Katun\"\x00", 'qty' => 80],
            ['id' => 'i-2', 'name' => '=SUM(1,2)', 'qty' => 12],
        ],
    );

    expect($count)->toBe(2);

    $binary = (string) Storage::disk('local')->get('exports/test.xlsx');
    expect(str_starts_with($binary, 'PK'))->toBeTrue();

    $tmp = tempnam(sys_get_temp_dir(), 'xlsx_unit_');
    file_put_contents($tmp, $binary);

    $zip = new ZipArchive;
    expect($zip->open($tmp, ZipArchive::CHECKCONS))->toBeTrue();

    $expectedParts = [
        '[Content_Types].xml',
        '_rels/.rels',
        'xl/workbook.xml',
        'xl/_rels/workbook.xml.rels',
        'xl/styles.xml',
        'xl/worksheets/sheet1.xml',
    ];

    foreach ($expectedParts as $part) {
        $partXml = $zip->getFromName($part);
        expect($partXml)->toBeString()->not->toBeEmpty();
        $dom = new DOMDocument;
        expect($dom->loadXML((string) $partXml))->toBeTrue();
    }

    $sheetXml = (string) $zip->getFromName('xl/worksheets/sheet1.xml');
    $zip->close();
    @unlink($tmp);

    $sheetDom = new DOMDocument;
    expect($sheetDom->loadXML($sheetXml))->toBeTrue();

    expect($sheetXml)->toContain('Nama &amp; Deskripsi')
        ->and($sheetXml)->toContain('Kain &lt;Linen&gt; &amp; &quot;Katun&quot;')
        ->and($sheetXml)->toContain('<v>80</v>')
        ->and($sheetXml)->toContain('&apos;=SUM(1,2)')
        ->and($sheetDom->textContent)->toContain("'=SUM(1,2)");
});

it('writes valid pure-PHP DOCX documents with strict ZIP integrity and well-formed WordprocessingML', function () {
    Storage::fake('local');

    $writer = new ReportFileWriter;
    $count = $writer->write(
        'local',
        'exports/test.docx',
        'docx',
        ['id' => 'ID', 'name' => 'Nama & Deskripsi', 'qty' => 'Jumlah'],
        [
            ['id' => 'i-1', 'name' => "Kain <Linen> & \"Katun\"\x00", 'qty' => 80],
            ['id' => 'i-2', 'name' => 'Besi Hollow', 'qty' => 12],
        ],
        'Laporan Stok Gudang',
    );

    expect($count)->toBe(2);

    $binary = (string) Storage::disk('local')->get('exports/test.docx');
    expect(str_starts_with($binary, 'PK'))->toBeTrue();

    $tmp = tempnam(sys_get_temp_dir(), 'docx_unit_');
    file_put_contents($tmp, $binary);

    $zip = new ZipArchive;
    expect($zip->open($tmp, ZipArchive::CHECKCONS))->toBeTrue();

    foreach ([
        '[Content_Types].xml',
        '_rels/.rels',
        'word/document.xml',
        'word/_rels/document.xml.rels',
        'word/styles.xml',
    ] as $part) {
        $xml = $zip->getFromName($part);
        expect($xml)->toBeString()->not->toBeEmpty();
        $dom = new DOMDocument;
        expect($dom->loadXML((string) $xml))->toBeTrue();
    }

    $docXml = (string) $zip->getFromName('word/document.xml');
    $zip->close();
    @unlink($tmp);

    $docDom = new DOMDocument;
    expect($docDom->loadXML($docXml))->toBeTrue();
    expect($docXml)->toContain('Laporan Stok Gudang')
        ->and($docXml)->toContain('Nama &amp; Deskripsi')
        ->and($docXml)->toContain('Kain &lt;Linen&gt; &amp; &quot;Katun&quot;')
        ->and($docDom->textContent)->toContain('Besi Hollow')
        ->and($docDom->textContent)->toContain('80');
});

it('writes valid multi-page pure-PHP PDF 1.4 tabular reports with xref and page numbers', function () {
    Storage::fake('local');

    $rows = [];
    for ($i = 1; $i <= 45; $i++) {
        $rows[] = [
            'id' => "item-{$i}",
            'name' => "Barang (Uji) #{$i} — Batch \\A",
            'qty' => $i * 10,
        ];
    }

    $writer = new ReportFileWriter;
    $count = $writer->write(
        'local',
        'exports/test.pdf',
        'pdf',
        ['id' => 'ID', 'name' => 'Nama Barang', 'qty' => 'Jumlah'],
        $rows,
        'Laporan Barang (PDF)',
    );

    expect($count)->toBe(45);

    $binary = (string) Storage::disk('local')->get('exports/test.pdf');
    expect(str_starts_with($binary, '%PDF-1.4'))->toBeTrue()
        ->and(str_contains($binary, 'xref'))->toBeTrue()
        ->and(str_contains($binary, 'trailer'))->toBeTrue()
        ->and(str_contains($binary, '%%EOF'))->toBeTrue()
        ->and(str_contains($binary, 'Laporan Barang \\(PDF\\)'))->toBeTrue()
        ->and(str_contains($binary, 'Barang \\(Uji\\) #1'))->toBeTrue()
        ->and(str_contains($binary, 'Barang \\(Uji\\) #45'))->toBeTrue()
        ->and(str_contains($binary, 'Halaman 2 /'))->toBeTrue();
});
