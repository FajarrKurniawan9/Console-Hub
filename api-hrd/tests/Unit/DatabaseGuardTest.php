<?php

use App\Support\DatabaseGuard;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

uses(TestCase::class);

afterEach(function () {
    DatabaseGuard::$resolver = null;
    DatabaseGuard::$enabled = true;
});

it('passes when the active database matches expected database', function () {
    DatabaseGuard::$resolver = fn () => 'console_hr';

    DatabaseGuard::assert();
})->throwsNoExceptions();

it('refuses any other database name', function (string $name) {
    DatabaseGuard::$resolver = fn () => $name;

    DatabaseGuard::assert();
})->with(['neondb', 'console_gudang', 'consolehub_test', 'console_produksi', 'postgres'])
    ->throws(RuntimeException::class, 'Periksa DB_DATABASE / EXPECTED_DB di .env.');

it('asks the server for current_database() when no resolver is set', function () {
    expect(DatabaseGuard::currentDatabase(DB::connection()))->toBe(DB::connection()->getDatabaseName());
});
