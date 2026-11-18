<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('log_sync_state', function (Blueprint $table) {
            $table->foreignId('console_id')->primary()->constrained('consoles')->cascadeOnDelete();
            $table->jsonb('cursor')->default(DB::raw("'{}'::jsonb"));
            $table->timestampTz('last_synced_at')->nullable();
            $table->timestampTz('last_success_at')->nullable();
            $table->text('last_error')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('log_sync_state');
    }
};
