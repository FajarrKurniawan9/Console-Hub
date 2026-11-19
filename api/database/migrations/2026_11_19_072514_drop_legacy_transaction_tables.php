<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Update 1: no two-phase transactions, consistency checks or generated codes any more, and each
 * source API owns exactly one resource (`items`, `productions`, `people`).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('DROP TABLE IF EXISTS consistency_findings, consistency_checks, transaction_participants, transactions, code_counters');

        DB::statement("ALTER TABLE consoles ADD COLUMN resource VARCHAR(20) CHECK (resource IN ('items','productions','people'))");
        DB::statement(<<<'SQL'
            UPDATE consoles SET resource = CASE slug
              WHEN 'gudang' THEN 'items' WHEN 'produksi' THEN 'productions' WHEN 'hr' THEN 'people' END
        SQL);
        DB::statement('ALTER TABLE consoles ALTER COLUMN resource SET NOT NULL');
        DB::statement('ALTER TABLE consoles ADD CONSTRAINT consoles_resource_unique UNIQUE (resource)');
        DB::statement('ALTER TABLE consoles DROP COLUMN is_owner_of');
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE consoles ADD COLUMN is_owner_of TEXT[] NOT NULL DEFAULT '{}'");
        DB::statement('ALTER TABLE consoles DROP COLUMN resource');
    }
};
