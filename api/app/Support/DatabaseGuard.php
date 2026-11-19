<?php

namespace App\Support;

use Closure;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Refuses to run against any database other than the one portal database (`consolehub_test`).
 */
class DatabaseGuard
{
    public const EXPECTED = 'consolehub_test';

    /**
     * Test hook: returns the active database name instead of asking the server.
     *
     * @var (Closure(Connection): string)|null
     */
    public static ?Closure $resolver = null;

    /** Commands that must run on any database (hub:db-check reports instead of failing). */
    public static bool $enabled = true;

    /** @var list<string> */
    public const GUARDED_COMMANDS = ['migrate', 'migrate:fresh', 'migrate:refresh', 'migrate:reset', 'migrate:rollback', 'db:seed', 'hub:seed-demo'];

    public static function assert(?Connection $connection = null): void
    {
        if (! self::$enabled) {
            return;
        }

        $connection ??= DB::connection();
        $actual = self::currentDatabase($connection);

        if ($actual !== self::EXPECTED) {
            throw new RuntimeException(sprintf(
                'DatabaseGuard: koneksi "%s" terhubung ke database "%s", seharusnya "%s". Periksa DB_DATABASE di .env.',
                $connection->getName(), $actual, self::EXPECTED,
            ));
        }
    }

    public static function currentDatabase(Connection $connection): string
    {
        if (self::$resolver !== null) {
            return (self::$resolver)($connection);
        }

        return (string) $connection->selectOne('select current_database() as db')->db;
    }
}
