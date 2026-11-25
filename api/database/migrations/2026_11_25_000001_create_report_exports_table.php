<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_exports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('requester_role', 60)->nullable();
            $table->string('type', 32);
            $table->string('name', 160);
            $table->string('format', 16)->default('csv');
            $table->string('status', 20)->default('pending');
            $table->jsonb('filters')->nullable();
            $table->string('file_path', 255)->nullable();
            $table->unsignedInteger('row_count')->nullable();
            $table->text('error_message')->nullable();
            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();

            $table->index(['user_id', 'created_at'], 'idx_report_exports_user_time');
            $table->index(['status', 'id'], 'idx_report_exports_status_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_exports');
    }
};
