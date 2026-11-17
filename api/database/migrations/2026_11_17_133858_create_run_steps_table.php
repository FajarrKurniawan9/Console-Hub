<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('run_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('run_id')->constrained('process_runs')->cascadeOnDelete();
            $table->foreignId('process_step_id')->nullable()->constrained('process_steps')->nullOnDelete();
            $table->smallInteger('position');
            $table->string('name', 120);
            $table->foreignId('console_id')->nullable()->constrained('consoles')->nullOnDelete();
            $table->string('status', 20)->default('pending');
            $table->smallInteger('attempt')->default(0);
            $table->jsonb('request')->nullable();
            $table->smallInteger('response_status')->nullable();
            $table->jsonb('response_body')->nullable();
            $table->text('error')->nullable();
            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('finished_at')->nullable();
            $table->integer('duration_ms')->nullable();

            $table->unique(['run_id', 'position']);
        });

        DB::statement("ALTER TABLE run_steps ADD CONSTRAINT run_steps_status_check CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'skipped', 'compensated', 'compensation_failed'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('run_steps');
    }
};
