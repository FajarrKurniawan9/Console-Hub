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
            $table->foreignId('process_id')->constrained()->cascadeOnDelete();
            $table->smallInteger('position');
            $table->string('name');
            $table->foreignId('console_id')->constrained();
            $table->string('method');
            $table->string('path');
            $table->jsonb('body_template')->nullable();
            $table->jsonb('expect_status')->default('[200,201,204]');
            $table->integer('timeout_seconds')->default(10);
            $table->integer('max_retries')->default(0);
            $table->string('on_failure')->default('stop');
            $table->jsonb('compensation')->nullable();
            $table->timestampsTz();

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
