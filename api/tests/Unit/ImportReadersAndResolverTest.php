<?php

use App\Models\DataImport;
use App\Services\Imports\CsvReader;
use App\Services\Imports\ImportReferenceResolver;
use App\Services\Imports\PureZipReader;
use App\Services\Imports\TabularFileReader;
use App\Services\Imports\XlsxWorkbookReader;
use App\Services\Reports\PureZipWriter;
use App\Services\Reports\XlsxWorkbookWriter;
use App\Support\ApiException;
use Illuminate\Http\UploadedFile;

it('round-trips XLSX files written by XlsxWorkbookWriter using pure-PHP PureZipReader and XlsxWorkbookReader', function () {
    $tmp = tempnam(sys_get_temp_dir(), 'xlsx_rt_');
    expect($tmp)->not->toBeFalse();

    $writer = new XlsxWorkbookWriter;
    $writer->writeToFile(
        (string) $tmp,
        ['id', 'name', 'kind', 'production', 'responsible', 'quantity', 'unit'],
        [
            ['', 'Kain Katun', 'kain', 'Area Tekstil A · Tenun', 'Sari', 0, 'm'],
            ['', 'Benang <Sutra> & "Halus"', 'benang', null, null, 25, 'roll'],
        ],
        'Barang',
    );

    $reader = new XlsxWorkbookReader;
    $rows = $reader->read((string) $tmp);
    @unlink((string) $tmp);

    expect($rows)->toHaveCount(3)
        ->and($rows[0]['cells'])->toBe(['id', 'name', 'kind', 'production', 'responsible', 'quantity', 'unit'])
        ->and($rows[1]['cells'])->toBe(['', 'Kain Katun', 'kain', 'Area Tekstil A · Tenun', 'Sari', '0', 'm'])
        ->and($rows[2]['cells'])->toBe(['', 'Benang <Sutra> & "Halus"', 'benang', '', '', '25', 'roll']);
});

it('parses XLSX sharedStrings, rich text, booleans, sparse coordinates, and rejects XXE or Zip Bombs', function () {
    $tmp = tempnam(sys_get_temp_dir(), 'xlsx_sparse_');
    $zipWriter = new PureZipWriter;

    $zipWriter->write((string) $tmp, [
        '[Content_Types].xml' => '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
        'xl/workbook.xml' => '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels' => '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        'xl/sharedStrings.xml' => '<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>name</t></si><si><r><t>role</t></r></si><si><r><t>Sari </t></r><r><t>Dewi</t></r></si></sst>',
        'xl/worksheets/sheet1.xml' => '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>id</t></is></c><c r="B1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row><row r="2"><c r="B2" t="s"><v>2</v></c><c r="C2" t="inlineStr"><is><t>Kurir</t></is></c></row></sheetData></worksheet>',
    ]);

    $reader = new XlsxWorkbookReader;
    $rows = $reader->read((string) $tmp);
    @unlink((string) $tmp);

    expect($rows)->toHaveCount(2)
        ->and($rows[0])->toBe(['row_number' => 1, 'cells' => ['id', 'name', 'role']])
        ->and($rows[1])->toBe(['row_number' => 2, 'cells' => ['', 'Sari Dewi', 'Kurir']]);

    // Path traversal guard
    $badZip = tempnam(sys_get_temp_dir(), 'zip_trav_');
    $zipWriter->write((string) $badZip, ['../evil.xml' => '<root/>']);
    expect(fn () => (new PureZipReader)->readFile((string) $badZip))->toThrow(ApiException::class);
    @unlink((string) $badZip);

    // XXE guard
    $xxeZip = tempnam(sys_get_temp_dir(), 'xlsx_xxe_');
    $zipWriter->write((string) $xxeZip, [
        'xl/worksheets/sheet1.xml' => '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><worksheet/>',
    ]);
    expect(fn () => $reader->read((string) $xxeZip))->toThrow(ApiException::class);
    @unlink((string) $xxeZip);
});

it('parses UTF-8 BOM CSV with semicolon delimiter and validates strict headers and row limits', function () {
    $csvTmp = tempnam(sys_get_temp_dir(), 'csv_semi_').'.csv';
    file_put_contents($csvTmp, "\xEF\xBB\xBFname;email;role_code\r\n Budi ; BUDI@example.com ; user \r\n;;\r\n");

    $csvRows = (new CsvReader)->read($csvTmp);
    expect($csvRows)->toHaveCount(2)
        ->and($csvRows[0]['cells'])->toBe(['name', 'email', 'role_code'])
        ->and($csvRows[1]['cells'])->toBe(['Budi', 'BUDI@example.com', 'user']);

    $uploaded = new UploadedFile($csvTmp, 'users.csv', 'text/csv', null, true);
    $parsed = (new TabularFileReader)->read($uploaded, DataImport::TYPE_USERS);
    @unlink($csvTmp);

    expect($parsed['format'])->toBe('csv')
        ->and($parsed['rows'])->toBe([
            ['row_number' => 2, 'values' => ['name' => 'Budi', 'email' => 'BUDI@example.com', 'role_code' => 'user']],
        ]);

    // Reject unknown column
    $badHeaderTmp = tempnam(sys_get_temp_dir(), 'csv_bad_').'.csv';
    file_put_contents($badHeaderTmp, "name,email,role_code,extra\nBudi,b@example.com,user,1\n");
    $badUploaded = new UploadedFile($badHeaderTmp, 'users.csv', 'text/csv', null, true);
    expect(fn () => (new TabularFileReader)->read($badUploaded, DataImport::TYPE_USERS))->toThrow(ApiException::class);
    @unlink($badHeaderTmp);

    // Reject > 300 rows
    $tooManyTmp = tempnam(sys_get_temp_dir(), 'csv_301_').'.csv';
    $lines = ['name,email,role_code'];
    for ($i = 1; $i <= 301; $i++) {
        $lines[] = "User {$i},u{$i}@example.com,user";
    }
    file_put_contents($tooManyTmp, implode("\n", $lines));
    $tooManyUploaded = new UploadedFile($tooManyTmp, 'many.csv', 'text/csv', null, true);
    expect(fn () => (new TabularFileReader)->read($tooManyUploaded, DataImport::TYPE_USERS))->toThrow(ApiException::class);
    @unlink($tooManyTmp);
});

it('resolves hybrid references unambiguously and rejects inactive or ambiguous matches', function () {
    $resolver = app(ImportReferenceResolver::class);

    $people = [
        '11111111-1111-4111-8111-111111111111' => ['id' => '11111111-1111-4111-8111-111111111111', 'name' => 'Sari', 'role' => 'Kurir', 'status' => 'aktif'],
        '22222222-2222-4222-8222-222222222222' => ['id' => '22222222-2222-4222-8222-222222222222', 'name' => 'Sari', 'role' => 'Operator', 'status' => 'aktif'],
        '33333333-3333-4333-8333-333333333333' => ['id' => '33333333-3333-4333-8333-333333333333', 'name' => 'Budi', 'role' => 'Kurir', 'status' => 'aktif'],
        '44444444-4444-4444-8444-444444444444' => ['id' => '44444444-4444-4444-8444-444444444444', 'name' => 'Lama', 'role' => 'Kurir', 'status' => 'nonaktif'],
    ];

    expect($resolver->resolvePerson('Budi', $people)['id'])->toBe('33333333-3333-4333-8333-333333333333')
        ->and($resolver->resolvePerson('Sari · Operator', $people)['id'])->toBe('22222222-2222-4222-8222-222222222222')
        ->and($resolver->resolvePerson('Sari | Kurir', $people)['id'])->toBe('11111111-1111-4111-8111-111111111111')
        ->and($resolver->resolvePerson('Sari', $people)['ok'])->toBeFalse()
        ->and($resolver->resolvePerson('Lama', $people)['ok'])->toBeFalse()
        ->and($resolver->resolvePerson('44444444-4444-4444-8444-444444444444', $people)['ok'])->toBeFalse();

    $productions = [
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' => ['id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'area' => 'Area Tekstil A', 'production_type' => 'Tenun', 'status' => 'aktif'],
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' => ['id' => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'area' => 'Area Lama', 'production_type' => 'Cetak', 'status' => 'nonaktif'],
    ];

    expect($resolver->resolveProduction('Area Tekstil A · Tenun', $productions)['id'])->toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
        ->and($resolver->resolveProduction('Area Tekstil A | Tenun', $productions)['id'])->toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
        ->and($resolver->resolveProduction('Area Tekstil A', $productions)['ok'])->toBeFalse()
        ->and($resolver->resolveProduction('Area Lama · Cetak', $productions)['ok'])->toBeFalse();
});
