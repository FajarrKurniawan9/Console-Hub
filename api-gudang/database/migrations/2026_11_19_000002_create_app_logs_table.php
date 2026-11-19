<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::statement(<<<'SQL'
            CREATE TABLE app_logs (
                id BIGSERIAL PRIMARY KEY,
                occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                level VARCHAR(8) NOT NULL CONSTRAINT app_logs_level_check CHECK (level IN ('debug','info','warn','error')),
                message TEXT NOT NULL,
                actor VARCHAR(120) NULL,
                request_id VARCHAR(64) NULL,
                context JSONB NULL
            );
        SQL);

        DB::statement('CREATE INDEX app_logs_time_idx ON app_logs (occurred_at DESC);');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS app_logs;');
    }
};
