<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('consoles', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('base_url');
            $table->string('auth_type');
            $table->text('credentials');
            $table->jsonb('config')->default('{}');
            $table->string('timezone')->default('UTC');
            $table->boolean('is_active')->default(true);
            $table->string('status')->default('unknown');
            $table->integer('last_latency_ms')->nullable();
            $table->timestampTz('last_checked_at')->nullable();
            $table->timestampsTz();
        });

        DB::statement("ALTER TABLE consoles ADD CONSTRAINT consoles_auth_type_check CHECK (auth_type IN ('api_key', 'bearer', 'basic'))");
        DB::statement("ALTER TABLE consoles ADD CONSTRAINT consoles_status_check CHECK (status IN ('ok', 'slow', 'down', 'unknown'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('consoles');
    }
};
