<?php

namespace App\Http\Resources;

use App\Models\DataImport;
use App\Support\Iso;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Frontend `DataImportSummary` / `DataImportDetail` (web/src/lib/api/schemas.ts).
 *
 * @mixin DataImport
 */
class DataImportResource extends JsonResource
{
    public function __construct(DataImport $resource, private readonly bool $detail = false)
    {
        parent::__construct($resource);
    }

    /**
     * @param  iterable<int, DataImport>  $imports
     * @return list<self>
     */
    public static function summaryCollection(iterable $imports): array
    {
        $items = [];

        foreach ($imports as $import) {
            $items[] = new self($import, detail: false);
        }

        return $items;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $base = [
            'id' => $this->id,
            'type' => $this->type,
            'mode' => $this->mode,
            'status' => $this->status,
            'original_filename' => $this->original_filename,
            'file_format' => $this->file_format,
            'total_rows' => $this->total_rows,
            'valid_rows' => $this->valid_rows,
            'create_count' => $this->create_count,
            'update_count' => $this->update_count,
            'skip_count' => $this->skip_count,
            'invalid_count' => $this->invalid_count,
            'processed_rows' => $this->processed_rows,
            'created_count' => $this->created_count,
            'updated_count' => $this->updated_count,
            'skipped_count' => $this->skipped_count,
            'failed_count' => $this->failed_count,
            'error_message' => $this->error_message,
            'cancel_requested' => $this->cancel_requested_at !== null,
            'validated_at' => Iso::utc($this->validated_at),
            'started_at' => Iso::utc($this->started_at),
            'completed_at' => Iso::utc($this->completed_at),
            'cancelled_at' => Iso::utc($this->cancelled_at),
            'created_at' => Iso::utc($this->created_at),
        ];

        if (! $this->detail) {
            return $base;
        }

        $planRows = [];

        foreach ($this->plan_rows ?? [] as $row) {
            $rawDiff = is_array($row['diff'] ?? null) ? $row['diff'] : [];
            $rawErrors = is_array($row['errors'] ?? null) ? $row['errors'] : [];
            $rawValues = is_array($row['values'] ?? null) ? $row['values'] : [];

            $planRows[] = [
                'row_number' => (int) ($row['row_number'] ?? 0),
                'action' => (string) ($row['action'] ?? 'invalid'),
                'target_id' => $row['target_id'] ?? null,
                'values' => (object) $rawValues,
                'diff' => $rawDiff !== [] ? (object) $rawDiff : null,
                'reason' => $row['reason'] ?? null,
                'errors' => (object) $rawErrors,
            ];
        }

        $executionResults = [];

        foreach ($this->execution_results ?? [] as $result) {
            $executionResults[] = [
                'row_number' => (int) ($result['row_number'] ?? 0),
                'status' => (string) ($result['status'] ?? ''),
                'action' => (string) ($result['action'] ?? ''),
                'target_id' => $result['target_id'] ?? null,
                'reason' => $result['reason'] ?? null,
            ];
        }

        return [
            ...$base,
            'plan_rows' => $planRows,
            'execution_results' => $executionResults,
        ];
    }
}
