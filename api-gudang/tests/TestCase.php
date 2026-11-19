<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->setUpDatabase();
    }

    protected function setUpDatabase(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            $pdo = DB::connection()->getPdo();
            if (method_exists($pdo, 'sqliteCreateFunction')) {
                $pdo->sqliteCreateFunction('gen_random_uuid', fn (): string => (string) Str::uuid());
                $pdo->sqliteCreateFunction('now', fn (): string => now()->toISOString());
            }

            DB::statement('CREATE TABLE IF NOT EXISTS items (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                kind TEXT NOT NULL,
                production_id TEXT NULL,
                responsible_id TEXT NULL,
                quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
                unit TEXT NOT NULL DEFAULT \'pcs\',
                status TEXT NOT NULL DEFAULT \'aktif\' CHECK (status IN (\'aktif\',\'nonaktif\')),
                version INTEGER NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )');
            DB::statement('CREATE INDEX IF NOT EXISTS items_production_idx ON items (production_id)');
            DB::statement('CREATE INDEX IF NOT EXISTS items_responsible_idx ON items (responsible_id)');
            DB::statement('CREATE INDEX IF NOT EXISTS items_kind_idx ON items (kind)');
            DB::statement('CREATE INDEX IF NOT EXISTS items_status_idx ON items (status)');

            DB::statement('CREATE TABLE IF NOT EXISTS app_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                level TEXT NOT NULL CHECK (level IN (\'debug\',\'info\',\'warn\',\'error\')),
                message TEXT NOT NULL,
                actor TEXT NULL,
                request_id TEXT NULL,
                context JSON NULL
            )');
            DB::statement('CREATE INDEX IF NOT EXISTS app_logs_time_idx ON app_logs (occurred_at DESC)');

            DB::table('items')->delete();
            DB::table('app_logs')->delete();
        }
    }
}
