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
            CREATE TABLE items (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(120) NOT NULL,
                kind VARCHAR(60) NOT NULL,
                production_id UUID NULL,
                responsible_id UUID NULL,
                quantity INTEGER NOT NULL DEFAULT 0 CONSTRAINT items_quantity_check CHECK (quantity >= 0),
                unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
                status VARCHAR(10) NOT NULL DEFAULT 'aktif' CONSTRAINT items_status_check CHECK (status IN ('aktif','nonaktif')),
                version INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        SQL);

        DB::statement('CREATE INDEX items_production_idx ON items (production_id);');
        DB::statement('CREATE INDEX items_responsible_idx ON items (responsible_id);');
        DB::statement('CREATE INDEX items_kind_idx ON items (kind);');
        DB::statement('CREATE INDEX items_status_idx ON items (status);');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS items;');
    }
};
