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
            CREATE TABLE people (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(120) NOT NULL,
                role VARCHAR(60) NOT NULL,
                status VARCHAR(10) NOT NULL DEFAULT 'aktif' CONSTRAINT people_status_check CHECK (status IN ('aktif','nonaktif')),
                version INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        SQL);

        DB::statement('CREATE INDEX people_status_idx ON people (status);');
        DB::statement('CREATE INDEX people_name_idx ON people (lower(name));');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS people;');
    }
};
