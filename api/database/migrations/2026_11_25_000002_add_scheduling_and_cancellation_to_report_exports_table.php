<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('report_exports', function (Blueprint $table) {
            $table->string('schedule_type', 20)->default('immediate')->after('status');
            $table->string('cron_expression', 64)->nullable()->after('schedule_type');
            $table->string('timezone', 64)->default('Asia/Jakarta')->after('cron_expression');
            $table->timestampTz('scheduled_at')->nullable()->after('timezone');
            $table->timestampTz('cancelled_at')->nullable()->after('completed_at');
            $table->foreignId('parent_export_id')->nullable()->after('user_id')->constrained('report_exports')->nullOnDelete();

            $table->index(['status', 'scheduled_at', 'id'], 'idx_report_exports_status_scheduled_id');
        });
    }

    public function down(): void
    {
        Schema::table('report_exports', function (Blueprint $table) {
            $table->dropIndex('idx_report_exports_status_scheduled_id');
            $table->dropConstrainedForeignId('parent_export_id');
            $table->dropColumn(['schedule_type', 'cron_expression', 'timezone', 'scheduled_at', 'cancelled_at']);
        });
    }
};
