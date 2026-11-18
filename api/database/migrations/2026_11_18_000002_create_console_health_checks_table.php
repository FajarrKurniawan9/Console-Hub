<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('console_health_checks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('console_id')->constrained()->cascadeOnDelete();
            $table->string('status');
            $table->integer('latency_ms')->nullable();
            $table->text('message')->nullable();
            $table->timestampTz('checked_at');
            $table->timestampsTz();
        });

        DB::statement("ALTER TABLE console_health_checks ADD CONSTRAINT console_health_checks_status_check CHECK (status IN ('ok', 'slow', 'down'))");
        DB::statement('CREATE INDEX console_health_checks_console_checked_idx ON console_health_checks (console_id, checked_at DESC)');
    }

    public function down(): void
    {
        Schema::dropIfExists('console_health_checks');
    }
};
