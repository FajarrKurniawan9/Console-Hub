<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            CREATE TABLE consistency_checks (
              id BIGSERIAL PRIMARY KEY,
              entity_type VARCHAR(30) NOT NULL,
              status VARCHAR(10) NOT NULL DEFAULT 'running' CHECK (status IN ('running','clean','drift','failed')),
              checked_count INTEGER NOT NULL DEFAULT 0,
              drift_count INTEGER NOT NULL DEFAULT 0,
              triggered_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
              started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              finished_at TIMESTAMPTZ
            )
        SQL);

        DB::statement(<<<'SQL'
            CREATE TABLE consistency_findings (
              id BIGSERIAL PRIMARY KEY,
              check_id BIGINT NOT NULL REFERENCES consistency_checks(id) ON DELETE CASCADE,
              entity_type VARCHAR(30) NOT NULL,
              entity_id UUID NOT NULL,
              console_id BIGINT NOT NULL REFERENCES consoles(id),
              kind VARCHAR(20) NOT NULL CHECK (kind IN ('missing','version_mismatch','checksum_mismatch')),
              owner_version INTEGER,
              console_version INTEGER,
              repaired_at TIMESTAMPTZ
            )
        SQL);
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS consistency_findings, consistency_checks');
    }
};
