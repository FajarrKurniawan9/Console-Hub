<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
{
    Schema::create('consoles', function (Blueprint $table) {
        $table->id();
        $table->string('slug', 40)->unique();
        $table->string('name', 100);
        $table->string('base_url', 255);
        $table->string('auth_type', 10);
        $table->text('credentials')->nullable();
        $table->jsonb('config')->default(DB::raw("'{}'::jsonb"));
        $table->string('timezone', 40)->default('UTC');
        $table->boolean('is_active')->default(true);
        $table->string('status', 10)->default('unknown');
        $table->integer('last_latency_ms')->nullable();
        $table->timestampTz('last_checked_at')->nullable();
        $table->timestampsTz();
    });

    DB::statement("ALTER TABLE consoles ADD CONSTRAINT consoles_auth_type_check CHECK (auth_type IN ('api_key', 'bearer', 'basic'))");
    DB::statement("ALTER TABLE consoles ADD CONSTRAINT consoles_status_check CHECK (status IN ('ok', 'slow', 'down', 'unknown'))");
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("ALTER TABLE consoles DROP CONSTRAINT IF EXISTS consoles_auth_type_check");
        DB::statement("ALTER TABLE consoles DROP CONSTRAINT IF EXISTS consoles_status_check");
        Schema::dropIfExists('consoles');
    }
};
