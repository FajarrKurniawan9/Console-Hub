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

it('writes valid XLSX workbooks readable via ZipArchive', function () {
    Storage::fake('local');

    $writer = new ReportFileWriter;
    $count = $writer->write(
        'local',
        'exports/test.xlsx',
        'xlsx',
        ['id' => 'ID', 'name' => 'Nama', 'qty' => 'Jumlah'],
        [
            ['id' => 'i-1', 'name' => 'Kain Linen', 'qty' => 80],
            ['id' => 'i-2', 'name' => '=SUM(1,2)', 'qty' => 12],
        ],
    );

    expect($count)->toBe(2);

    $binary = (string) Storage::disk('local')->get('exports/test.xlsx');
    expect(str_starts_with($binary, 'PK'))->toBeTrue();

    $tmp = tempnam(sys_get_temp_dir(), 'xlsx_unit_');
    file_put_contents($tmp, $binary);
    $zip = new ZipArchive;
    expect($zip->open($tmp))->toBeTrue();
    $xml = (string) $zip->getFromName('xl/worksheets/sheet1.xml').(string) $zip->getFromName('xl/sharedStrings.xml');
    $zip->close();
    @unlink($tmp);

    expect($xml)->toContain('Kain Linen')
        ->and($xml)->toContain('Nama')
        ->and($xml)->toContain("'=SUM(1,2)");
});
