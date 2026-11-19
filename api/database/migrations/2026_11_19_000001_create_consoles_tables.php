<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            CREATE TABLE consoles (
              id BIGSERIAL PRIMARY KEY,
              slug VARCHAR(30) NOT NULL UNIQUE,
              name VARCHAR(60) NOT NULL,
              base_url VARCHAR(255) NOT NULL,
              auth_type VARCHAR(10) NOT NULL DEFAULT 'api_key'
                CHECK (auth_type IN ('api_key','bearer','basic')),
              service_key TEXT,
              is_active BOOLEAN NOT NULL DEFAULT TRUE,
              is_owner_of TEXT[] NOT NULL DEFAULT '{}',
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        SQL);

        DB::statement(<<<'SQL'
            CREATE TABLE console_health_checks (
              id BIGSERIAL PRIMARY KEY,
              console_id BIGINT NOT NULL REFERENCES consoles(id) ON DELETE CASCADE,
              ok BOOLEAN NOT NULL,
              latency_ms INTEGER,
              error TEXT,
              checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        SQL);
        DB::statement('CREATE INDEX idx_health_console_time ON console_health_checks (console_id, checked_at DESC)');

        DB::statement(<<<'SQL'
            CREATE TABLE log_sync_state (
              console_id BIGINT PRIMARY KEY REFERENCES consoles(id) ON DELETE CASCADE,
              last_synced_at TIMESTAMPTZ,
              last_cursor VARCHAR(120),
              last_error TEXT
            )
        SQL);

        DB::statement(<<<'SQL'
            CREATE TABLE log_entries (
              id BIGSERIAL PRIMARY KEY,
              console_id BIGINT NOT NULL REFERENCES consoles(id) ON DELETE CASCADE,
              occurred_at TIMESTAMPTZ NOT NULL,
              level VARCHAR(5) NOT NULL CHECK (level IN ('debug','info','warn','error')),
              message TEXT NOT NULL,
              actor VARCHAR(100),
              tx_id UUID,
              raw JSONB,
              fingerprint CHAR(40) NOT NULL,
              UNIQUE (console_id, fingerprint)
            )
        SQL);
        DB::statement('CREATE INDEX idx_log_time ON log_entries (occurred_at DESC)');
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS log_entries, log_sync_state, console_health_checks, consoles');
    }
};
