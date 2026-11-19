<?php

use App\Support\DatabaseGuard;
use Illuminate\Support\Facades\DB;

afterEach(function () {
    DatabaseGuard::$resolver = null;
    DatabaseGuard::$enabled = true;
});

it('passes when the active database is consolehub_test', function () {
    DatabaseGuard::$resolver = fn () => 'consolehub_test';

    DatabaseGuard::assert();
})->throwsNoExceptions();

it('refuses any other database name', function (string $name) {
    DatabaseGuard::$resolver = fn () => $name;

    DatabaseGuard::assert();
})->with(['neondb', 'console_hr', 'console-test', 'console_test', 'postgres'])
    ->throws(RuntimeException::class, 'seharusnya "consolehub_test"');

it('asks the server for current_database() when no resolver is set', function () {
    expect(DatabaseGuard::currentDatabase(DB::connection()))->toBe(DB::connection()->getDatabaseName());
});
