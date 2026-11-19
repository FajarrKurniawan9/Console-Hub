<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            CREATE TABLE transactions (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              operation VARCHAR(40) NOT NULL,
              entity_type VARCHAR(30),
              entity_id UUID,
              payload JSONB NOT NULL,
              state VARCHAR(16) NOT NULL DEFAULT 'preparing'
                CHECK (state IN ('preparing','prepared','committing','committed','aborting','aborted','needs_attention')),
              idempotency_key VARCHAR(64) NOT NULL,
              requested_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
              result JSONB,
              failure_code VARCHAR(40),
              failure_console VARCHAR(30),
              failure_message TEXT,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              decided_at TIMESTAMPTZ,
              finished_at TIMESTAMPTZ,
              UNIQUE (requested_by, idempotency_key)
            )
        SQL);
        DB::statement('CREATE INDEX idx_tx_state ON transactions (state, created_at)');

        DB::statement(<<<'SQL'
            CREATE TABLE transaction_participants (
              tx_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
              console_id BIGINT NOT NULL REFERENCES consoles(id),
              prepare_state VARCHAR(10) NOT NULL DEFAULT 'pending'
                CHECK (prepare_state IN ('pending','ok','refused','error')),
              decision_state VARCHAR(10) NOT NULL DEFAULT 'pending'
                CHECK (decision_state IN ('pending','committed','aborted','failed')),
              refusal_code VARCHAR(40),
              refusal_message TEXT,
              attempts SMALLINT NOT NULL DEFAULT 0,
              last_error TEXT,
              latency_ms INTEGER,
              version INTEGER,
              prepared_at TIMESTAMPTZ,
              finished_at TIMESTAMPTZ,
              PRIMARY KEY (tx_id, console_id)
            )
        SQL);
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS transaction_participants, transactions');
    }
};
