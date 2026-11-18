<?php

namespace App\Http\Resources;

use App\Models\ProcessRun;
use App\Support\Iso;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ProcessRun
 */
class RunResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'process' => ['id' => $this->process_id, 'name' => $this->process->name],
            'status' => $this->status,
            'input' => (object) ($this->input ?? []),
            'triggered_by' => $this->triggeredBy
                ? ['id' => $this->triggeredBy->id, 'name' => $this->triggeredBy->name]
                : ['id' => 0, 'name' => 'Sistem'],
            'created_at' => Iso::utc($this->created_at),
            'started_at' => Iso::utc($this->started_at),
            'finished_at' => Iso::utc($this->finished_at),
            'error_summary' => $this->error_summary,
            'retry_of' => $this->retry_of,
            'steps' => RunStepResource::collection($this->whenLoaded('steps')),
        ];
    }
}
