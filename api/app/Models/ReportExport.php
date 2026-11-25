<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $user_id
 * @property string|null $requester_role
 * @property string $type
 * @property string $name
 * @property string $format
 * @property string $status
 * @property array<string, mixed>|null $filters
 * @property string|null $file_path
 * @property int|null $row_count
 * @property string|null $error_message
 * @property Carbon|null $started_at
 * @property Carbon|null $completed_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read User $user
 */
#[Fillable([
    'user_id',
    'requester_role',
    'type',
    'name',
    'format',
    'status',
    'filters',
    'file_path',
    'row_count',
    'error_message',
    'started_at',
    'completed_at',
])]
class ReportExport extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_PROCESSING = 'processing';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_FAILED = 'failed';

    /** @var list<string> */
    public const ACTIVE_STATUSES = [
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
    public const FORMATS = ['csv', 'xlsx', 'json'];

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
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
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
