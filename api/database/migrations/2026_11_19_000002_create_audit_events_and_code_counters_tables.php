<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            CREATE TABLE audit_events (
              id BIGSERIAL PRIMARY KEY,
              user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
              action VARCHAR(60) NOT NULL,
              subject_type VARCHAR(30),
              subject_id VARCHAR(60),
              old_value JSONB,
              new_value JSONB,
              request_id VARCHAR(40),
              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        SQL);
        DB::statement('CREATE INDEX idx_audit_time ON audit_events (created_at DESC, id DESC)');

        DB::statement(<<<'SQL'
            CREATE TABLE code_counters (
              counter_key VARCHAR(40) PRIMARY KEY,
              last_value BIGINT NOT NULL DEFAULT 0
            )
        SQL);
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS code_counters, audit_events');
    }
};
