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
            $table->foreignId('console_id')->constrained()->cascadeOnDelete();
            $table->timestampTz('occurred_at');
            $table->string('level');
            $table->text('message');
            $table->string('actor')->nullable();
            $table->char('dedupe_key', 40);
            $table->jsonb('raw')->nullable();
            $table->timestampTz('ingested_at')->useCurrent();
            $table->timestampsTz();

            $table->unique(['console_id', 'dedupe_key']);
        });

        DB::statement("ALTER TABLE log_entries ADD CONSTRAINT log_entries_level_check CHECK (level IN ('debug', 'info', 'warn', 'error'))");
        DB::statement('CREATE INDEX log_entries_occurred_idx ON log_entries (occurred_at DESC, id DESC)');
        DB::statement('CREATE INDEX log_entries_console_occurred_idx ON log_entries (console_id, occurred_at DESC)');
        DB::statement('CREATE INDEX log_entries_level_occurred_idx ON log_entries (level, occurred_at DESC)');
    }

    public function down(): void
    {
        Schema::dropIfExists('log_entries');
    }
};
