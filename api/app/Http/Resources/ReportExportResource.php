<?php

namespace App\Http\Resources;

use App\Models\ReportExport;
use App\Support\Iso;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Frontend `ReportExport` (web/src/lib/api/schemas.ts).
 *
 * @mixin ReportExport
 */
class ReportExportResource extends JsonResource
{
    public function __construct(ReportExport $resource, private readonly ?int $queuePosition = null)
    {
        parent::__construct($resource);
    }

    /**
     * @param  iterable<int, ReportExport>  $exports
     * @param  array<int, int>  $positions  export id => 1-based queue position
     * @return list<self>
     */
    public static function many(iterable $exports, array $positions = []): array
    {
        $items = [];

        foreach ($exports as $export) {
            $items[] = new self($export, $positions[$export->id] ?? null);
        }

        return $items;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $isMine = $request->user()?->id === $this->user_id;
        $isDownloadable = $isMine && $this->status === ReportExport::STATUS_COMPLETED;

        return [
            'id' => $this->id,
            'type' => $this->type,
            'name' => $this->name,
            'status' => $this->status,
            'format' => $this->format,
            'schedule_type' => $this->schedule_type ?: ReportExport::SCHEDULE_IMMEDIATE,
            'cron_expression' => $isMine ? $this->cron_expression : null,
            'timezone' => $isMine ? $this->timezone : null,
            'scheduled_at' => $isMine ? Iso::utc($this->scheduled_at) : null,
            'cancelled_at' => $isMine ? Iso::utc($this->cancelled_at) : null,
            'parent_export_id' => $isMine ? $this->parent_export_id : null,
            'file_url' => null,
            'download_url' => $isDownloadable ? "/reports/exports/{$this->id}/download" : null,
            'error_message' => $isMine ? $this->error_message : null,
            'row_count' => $isMine ? $this->row_count : null,
            'requester_role' => $this->requester_role,
            'requester_name' => $this->relationLoaded('user') ? $this->user->name : null,
            'is_mine' => $isMine,
            'queue_position' => $this->isActive() ? $this->queuePosition : null,
            'created_at' => Iso::utc($this->created_at),
            'completed_at' => $isMine ? Iso::utc($this->completed_at) : null,
        ];
    }
}
