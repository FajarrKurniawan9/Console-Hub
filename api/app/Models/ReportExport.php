<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $user_id
 * @property int|null $parent_export_id
 * @property string|null $requester_role
 * @property string $type
 * @property string $name
 * @property string $format
 * @property string $status
 * @property string $schedule_type
 * @property string|null $cron_expression
 * @property string $timezone
 * @property Carbon|null $scheduled_at
 * @property array<string, mixed>|null $filters
 * @property string|null $file_path
 * @property int|null $row_count
 * @property string|null $error_message
 * @property Carbon|null $started_at
 * @property Carbon|null $completed_at
 * @property Carbon|null $cancelled_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read User $user
 * @property-read ReportExport|null $parent
 */
#[Fillable([
    'user_id',
    'parent_export_id',
    'requester_role',
    'type',
    'name',
    'format',
    'status',
    'schedule_type',
    'cron_expression',
    'timezone',
    'scheduled_at',
    'filters',
    'file_path',
    'row_count',
    'error_message',
    'started_at',
    'completed_at',
    'cancelled_at',
])]
class ReportExport extends Model
{
    public const STATUS_SCHEDULED = 'scheduled';

    public const STATUS_PENDING = 'pending';

    public const STATUS_PROCESSING = 'processing';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_FAILED = 'failed';

    public const STATUS_CANCELLED = 'cancelled';

    public const SCHEDULE_IMMEDIATE = 'immediate';

    public const SCHEDULE_ONCE = 'once';

    public const SCHEDULE_RECURRING = 'recurring';

    /** @var list<string> */
    public const SCHEDULE_PRESETS = ['daily', 'weekly', 'monthly'];

    /** @var list<string> */
    public const ACTIVE_STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_PROCESSING,
    ];

    /** @var list<string> */
    public const CANCELLABLE_STATUSES = [
        self::STATUS_SCHEDULED,
        self::STATUS_PENDING,
    ];

    /** @var list<string> */
    public const NON_PRUNABLE_STATUSES = [
        self::STATUS_SCHEDULED,
        self::STATUS_PENDING,
        self::STATUS_PROCESSING,
    ];

    public const TYPE_AUDIT = 'audit';

    public const TYPE_LOGS = 'logs';

    public const TYPE_BARANG = 'barang';

    /** @var list<string> */
    public const TYPES = [
        self::TYPE_AUDIT,
        self::TYPE_LOGS,
        self::TYPE_BARANG,
    ];

    /** @var list<string> */
    public const FORMATS = ['csv', 'xlsx', 'json', 'pdf', 'docx'];

    /** @var array<string, string> */
    public const TYPE_PERMISSIONS = [
        self::TYPE_AUDIT => 'admin.audit.view',
        self::TYPE_LOGS => 'admin.logs.view',
        self::TYPE_BARANG => 'barang.view',
    ];

    /** @var array<string, string> */
    public const TYPE_LABELS = [
        self::TYPE_AUDIT => 'Laporan Audit Aktivitas',
        self::TYPE_LOGS => 'Laporan Log Gabungan',
        self::TYPE_BARANG => 'Laporan Data Barang Gudang',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'filters' => 'array',
            'row_count' => 'integer',
            'scheduled_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<ReportExport, $this>
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_export_id');
    }

    /**
     * @return HasMany<ReportExport, $this>
     */
    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_export_id');
    }

    public static function permissionFor(string $type): string
    {
        return self::TYPE_PERMISSIONS[$type];
    }

    public static function defaultNameFor(string $type, string $format): string
    {
        $label = self::TYPE_LABELS[$type] ?? "Export {$type}";

        return sprintf('%s (%s)', $label, strtoupper($format));
    }

    public function isActive(): bool
    {
        return in_array($this->status, self::ACTIVE_STATUSES, true);
    }
}
