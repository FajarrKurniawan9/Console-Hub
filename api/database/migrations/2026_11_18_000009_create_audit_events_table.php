<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action');
            $table->string('target_type')->nullable();
            $table->string('target_id')->nullable();
            $table->foreignId('console_id')->nullable()->constrained()->nullOnDelete();
            $table->jsonb('details')->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestampsTz();
        });

        DB::statement('CREATE INDEX audit_events_created_idx ON audit_events (created_at DESC, id DESC)');
        DB::statement('CREATE INDEX audit_events_console_created_idx ON audit_events (console_id, created_at DESC)');
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_events');
    }
};
