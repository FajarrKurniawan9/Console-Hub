<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('data_imports', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('requester_role', 60)->nullable();
            $table->string('type', 24);
            $table->string('mode', 20);
            $table->string('status', 20)->default('preview');
            $table->string('original_filename', 200);
            $table->string('file_format', 10);
            $table->unsignedInteger('total_rows')->default(0);
            $table->unsignedInteger('valid_rows')->default(0);
            $table->unsignedInteger('create_count')->default(0);
            $table->unsignedInteger('update_count')->default(0);
            $table->unsignedInteger('skip_count')->default(0);
            $table->unsignedInteger('invalid_count')->default(0);
            $table->unsignedInteger('processed_rows')->default(0);
            $table->unsignedInteger('created_count')->default(0);
            $table->unsignedInteger('updated_count')->default(0);
            $table->unsignedInteger('skipped_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->unsignedInteger('cursor_index')->default(0);
            $table->jsonb('source_rows')->nullable();
            $table->jsonb('plan_rows')->nullable();
            $table->jsonb('execution_results')->nullable();
            $table->text('error_message')->nullable();
            $table->timestampTz('validated_at')->nullable();
            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('last_chunk_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampTz('cancel_requested_at')->nullable();
            $table->timestampTz('cancelled_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();

            $table->index(['user_id', 'created_at'], 'idx_data_imports_user_created');
            $table->index(['type', 'completed_at'], 'idx_data_imports_type_completed');
            $table->index(['status', 'last_chunk_at'], 'idx_data_imports_status_chunk');
        });

        DB::statement("CREATE UNIQUE INDEX data_imports_active_type_unique ON data_imports (type) WHERE status IN ('queued', 'processing')");
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS data_imports_active_type_unique');
        Schema::dropIfExists('data_imports');
    }
};
