<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 60);
            $table->string('target_type', 40)->nullable();
            $table->string('target_id', 64)->nullable();
            $table->foreignId('console_id')->nullable()->constrained('consoles')->nullOnDelete();
            $table->jsonb('details')->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestampTz('created_at')->useCurrent();

            $table->index(['created_at'], 'idx_audit_time');
            $table->index(['console_id', 'created_at'], 'idx_audit_console_time');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_events');
    }
};
