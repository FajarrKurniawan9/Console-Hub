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
            CREATE TABLE productions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                area VARCHAR(80) NOT NULL,
                production_type VARCHAR(80) NOT NULL,
                courier_id UUID NULL,
                status VARCHAR(10) NOT NULL DEFAULT 'aktif' CONSTRAINT productions_status_check CHECK (status IN ('aktif','nonaktif')),
                version INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        SQL);

        DB::statement('CREATE INDEX productions_courier_idx ON productions (courier_id);');
        DB::statement('CREATE INDEX productions_status_idx ON productions (status);');
        DB::statement('CREATE UNIQUE INDEX productions_active_unique ON productions (lower(area), lower(production_type)) WHERE status = \'aktif\';');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS productions;');
    }
};
