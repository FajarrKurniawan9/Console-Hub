<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('process_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('process_id')->constrained('processes')->cascadeOnDelete();
            $table->smallInteger('position');
            $table->string('name', 120);
            $table->foreignId('console_id')->constrained('consoles');
            $table->string('method', 6);
            $table->string('path', 255);
            $table->jsonb('body_template')->nullable();
            $table->jsonb('expect_status')->default(DB::raw("'[200,201,204]'::jsonb"));
            $table->smallInteger('timeout_seconds')->default(10);
            $table->smallInteger('max_retries')->default(0);
            $table->string('on_failure', 10)->default('stop');
            $table->jsonb('compensation')->nullable();

            $table->unique(['process_id', 'position']);
        });

        DB::statement("ALTER TABLE process_steps ADD CONSTRAINT process_steps_method_check CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE'))");
        DB::statement("ALTER TABLE process_steps ADD CONSTRAINT process_steps_on_failure_check CHECK (on_failure IN ('stop', 'continue'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('process_steps');
    }
};
