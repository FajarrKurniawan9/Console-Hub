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
            $table->foreignId('console_id')->constrained('consoles')->cascadeOnDelete();
            $table->string('status', 10);
            $table->integer('latency_ms')->nullable();
            $table->string('message', 255)->nullable();
            $table->timestampTz('checked_at')->useCurrent();

            $table->index(['console_id', 'checked_at'], 'idx_health_console_time');
        });

        DB::statement("ALTER TABLE console_health_checks ADD CONSTRAINT console_health_checks_status_check CHECK (status IN ('ok', 'slow', 'down'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('console_health_checks');
    }
};
