<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('process_runs', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->foreignId('process_id')->constrained('processes');
            $table->string('status', 10)->default('queued');
            $table->jsonb('input')->default(DB::raw("'{}'::jsonb"));
            $table->foreignId('triggered_by')->nullable()->constrained('users')->nullOnDelete();
            $table->uuid('retry_of')->nullable();
            $table->text('error_summary')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('finished_at')->nullable();

            $table->index(['process_id', 'created_at'], 'idx_runs_process_time');
            $table->index(['status'], 'idx_runs_status');
        });

        Schema::table('process_runs', function (Blueprint $table) {
            $table->foreign('retry_of')->references('id')->on('process_runs')->nullOnDelete();
        });

        DB::statement("ALTER TABLE process_runs ADD CONSTRAINT process_runs_status_check CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'canceled'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('process_runs');
    }
};
