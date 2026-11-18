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
            $table->foreignId('process_id')->constrained();
            $table->string('status')->default('queued');
            $table->jsonb('input')->default('{}');
            $table->foreignId('triggered_by')->nullable()->constrained('users')->nullOnDelete();
            $table->uuid('retry_of')->nullable();
            $table->text('error_summary')->nullable();
            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('finished_at')->nullable();
            $table->timestampsTz();

            $table->index('status');
        });

        Schema::table('process_runs', function (Blueprint $table) {
            $table->foreign('retry_of')->references('id')->on('process_runs')->nullOnDelete();
        });

        DB::statement("ALTER TABLE process_runs ADD CONSTRAINT process_runs_status_check CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'canceled'))");
        DB::statement('CREATE INDEX process_runs_process_created_idx ON process_runs (process_id, created_at DESC)');
        DB::statement('CREATE INDEX process_runs_created_idx ON process_runs (created_at DESC, id DESC)');
    }

    public function down(): void
    {
        Schema::dropIfExists('process_runs');
    }
};
