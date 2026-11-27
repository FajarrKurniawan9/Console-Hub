<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Bulk multi-entity import ticket with dry-run plan, optimistic locking, and chunk progress tracking.
 *
 * @property int $id
 * @property int $user_id
 * @property string|null $requester_role
 * @property 'users'|'personel'|'produksi'|'barang' $type
 * @property 'create_only'|'upsert' $mode
 * @property string $status
 * @property string $original_filename
 * @property 'csv'|'xlsx' $file_format
 * @property int $total_rows
 * @property int $valid_rows
 * @property int $create_count
 * @property int $update_count
 * @property int $skip_count
 * @property int $invalid_count
 * @property int $processed_rows
 * @property int $created_count
 * @property int $updated_count
 * @property int $skipped_count
 * @property int $failed_count
 * @property int $cursor_index
 * @property list<array{row_number: int, values: array<string, string>}>|null $source_rows
 * @property list<array<string, mixed>>|null $plan_rows
 * @property list<array<string, mixed>>|null $execution_results
 * @property string|null $error_message
 * @property Carbon|null $validated_at
 * @property Carbon|null $started_at
 * @property Carbon|null $last_chunk_at
 * @property Carbon|null $completed_at
 * @property Carbon|null $cancel_requested_at
 * @property Carbon|null $cancelled_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read User $user
 */
#[Fillable([
    'user_id',
    'requester_role',
    'type',
    'mode',
    'status',
    'original_filename',
    'file_format',
    'total_rows',
    'valid_rows',
    'create_count',
    'update_count',
    'skip_count',
    'invalid_count',
    'processed_rows',
    'created_count',
    'updated_count',
    'skipped_count',
    'failed_count',
    'cursor_index',
    'source_rows',
    'plan_rows',
    'execution_results',
    'error_message',
    'validated_at',
    'started_at',
    'last_chunk_at',
    'completed_at',
    'cancel_requested_at',
    'cancelled_at',
])]
class DataImport extends Model
{
    public const STATUS_PREVIEW = 'preview';

    public const STATUS_QUEUED = 'queued';

    public const STATUS_PROCESSING = 'processing';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_FAILED = 'failed';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUS_EXPIRED = 'expired';

    /** @var list<string> */
    public const ACTIVE_STATUSES = [
        self::STATUS_QUEUED,
        self::STATUS_PROCESSING,
    ];

    /** @var list<string> */
    public const TERMINAL_STATUSES = [
        self::STATUS_COMPLETED,
        self::STATUS_FAILED,
        self::STATUS_CANCELLED,
        self::STATUS_EXPIRED,
    ];

    /** @var list<string> */
    public const NON_PRUNABLE_STATUSES = [
        self::STATUS_QUEUED,
        self::STATUS_PROCESSING,
    ];

    public const TYPE_USERS = 'users';

    public const TYPE_PERSONEL = 'personel';

    public const TYPE_PRODUKSI = 'produksi';

    public const TYPE_BARANG = 'barang';

    /** @var list<'users'|'personel'|'produksi'|'barang'> */
    public const TYPES = [
        self::TYPE_USERS,
        self::TYPE_PERSONEL,
        self::TYPE_PRODUKSI,
        self::TYPE_BARANG,
    ];

    public const MODE_CREATE_ONLY = 'create_only';

    public const MODE_UPSERT = 'upsert';

    /** @var list<'create_only'|'upsert'> */
    public const MODES = [
        self::MODE_CREATE_ONLY,
        self::MODE_UPSERT,
    ];

    /** @var list<'csv'|'xlsx'> */
    public const FORMATS = ['csv', 'xlsx'];

    /** @var array<string, list<string>> */
    public const CREATE_PERMISSIONS = [
        self::TYPE_USERS => ['admin.rbac.manage'],
        self::TYPE_PERSONEL => ['personel.create'],
        self::TYPE_PRODUKSI => ['produksi.create'],
        self::TYPE_BARANG => ['barang.create'],
    ];

    /** @var array<string, list<string>> */
    public const UPSERT_PERMISSIONS = [
        self::TYPE_USERS => ['admin.rbac.manage'],
        self::TYPE_PERSONEL => ['personel.create', 'personel.update'],
        self::TYPE_PRODUKSI => ['produksi.create', 'produksi.update'],
        self::TYPE_BARANG => ['barang.create', 'barang.update'],
    ];

    /** @var array<string, 'hr'|'produksi'|'gudang'|null> */
    public const CONSOLE_SLUGS = [
        self::TYPE_USERS => null,
        self::TYPE_PERSONEL => 'hr',
        self::TYPE_PRODUKSI => 'produksi',
        self::TYPE_BARANG => 'gudang',
    ];

    /** @var array<string, 'people'|'productions'|'items'|null> */
    public const RESOURCES = [
        self::TYPE_USERS => null,
        self::TYPE_PERSONEL => 'people',
        self::TYPE_PRODUKSI => 'productions',
        self::TYPE_BARANG => 'items',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'total_rows' => 'integer',
            'valid_rows' => 'integer',
            'create_count' => 'integer',
            'update_count' => 'integer',
            'skip_count' => 'integer',
            'invalid_count' => 'integer',
            'processed_rows' => 'integer',
            'created_count' => 'integer',
            'updated_count' => 'integer',
            'skipped_count' => 'integer',
            'failed_count' => 'integer',
            'cursor_index' => 'integer',
            'source_rows' => 'array',
            'plan_rows' => 'array',
            'execution_results' => 'array',
            'validated_at' => 'datetime',
            'started_at' => 'datetime',
            'last_chunk_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancel_requested_at' => 'datetime',
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
     * Required permissions to run or inspect an import for the given type and mode.
     *
     * @return list<string>
     */
    public static function requiredPermissions(string $type, string $mode = self::MODE_CREATE_ONLY): array
    {
        return $mode === self::MODE_UPSERT
            ? (self::UPSERT_PERMISSIONS[$type] ?? [])
            : (self::CREATE_PERMISSIONS[$type] ?? []);
    }

    public static function userCan(User $user, string $type, string $mode = self::MODE_CREATE_ONLY): bool
    {
        foreach (self::requiredPermissions($type, $mode) as $perm) {
            if (! $user->hasPermission($perm)) {
                return false;
            }
        }

        return self::requiredPermissions($type, $mode) !== [];
    }

    public function isActive(): bool
    {
        return in_array($this->status, self::ACTIVE_STATUSES, true);
    }
}
