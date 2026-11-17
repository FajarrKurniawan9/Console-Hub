<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('log_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('console_id')->constrained('consoles')->cascadeOnDelete();
            $table->timestampTz('occurred_at');
            $table->string('level', 5);
            $table->text('message');
            $table->string('actor', 100)->nullable();
            $table->char('dedupe_key', 40);
            $table->jsonb('raw')->nullable();
            $table->timestampTz('ingested_at')->useCurrent();

            $table->unique(['console_id', 'dedupe_key']);
            $table->index(['occurred_at'], 'idx_logs_time');
            $table->index(['console_id', 'occurred_at'], 'idx_logs_console_time');
            $table->index(['level', 'occurred_at'], 'idx_logs_level_time');
        });

        DB::statement("ALTER TABLE log_entries ADD CONSTRAINT log_entries_level_check CHECK (level IN ('debug', 'info', 'warn', 'error'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('log_entries');
    }
};
