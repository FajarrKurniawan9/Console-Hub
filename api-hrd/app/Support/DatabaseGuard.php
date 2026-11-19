<?php

namespace App\Support;

use Closure;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Refuses to run against any database other than the expected database (`console-hr` / `console_hr`).
 */
class DatabaseGuard
{
    /**
     * Test hook: returns the active database name instead of asking the server.
     *
     * @var (Closure(Connection): string)|null
     */
    public static ?Closure $resolver = null;

    public static bool $enabled = true;

    /** @var list<string> */
    public const GUARDED_COMMANDS = [
        'migrate',
        'migrate:fresh',
        'migrate:refresh',
        'migrate:reset',
        'migrate:rollback',
        'migrate:status',
        'db:seed',
    ];

    public static function expected(): string
    {
        return (string) (config('database.expected') ?: env('EXPECTED_DB', 'console_hr'));
    }

    public static function assert(?Connection $connection = null): void
    {
        if (! self::$enabled) {
            return;
        }

        $connection ??= DB::connection();
        $actual = self::currentDatabase($connection);
        $expected = self::expected();

        $normActual = str_replace('-', '_', $actual);
        $normExpected = str_replace('-', '_', $expected);

        if ($actual !== $expected && $normActual !== $normExpected) {
            throw new RuntimeException(sprintf(
                'DatabaseGuard: koneksi "%s" terhubung ke database "%s", seharusnya "%s". Periksa DB_DATABASE / EXPECTED_DB di .env.',
                $connection->getName(),
                $actual,
                $expected,
            ));
        }
    }

    public static function currentDatabase(Connection $connection): string
    {
        if (self::$resolver !== null) {
            return (self::$resolver)($connection);
        }

        if ($connection->getDriverName() === 'sqlite') {
            return $connection->getDatabaseName();
        }

        return (string) $connection->selectOne('SELECT current_database() AS db')->db;
    }
}
