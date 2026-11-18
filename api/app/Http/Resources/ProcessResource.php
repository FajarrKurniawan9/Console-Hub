<?php

namespace App\Http\Resources;

use App\Models\Process;
use App\Models\ProcessStep;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Process
 */
class ProcessResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'is_active' => $this->is_active,
            'input_schema' => (object) ($this->input_schema ?? []),
            'compensate_on_failure' => $this->compensate_on_failure,
            'steps' => $this->steps->map(fn (ProcessStep $step) => [
                'position' => $step->position,
                'name' => $step->name,
                'console' => ['slug' => $step->console->slug, 'name' => $step->console->name],
                'method' => $step->method,
                'path' => $step->path,
                'on_failure' => $step->on_failure,
                'max_retries' => $step->max_retries,
                'has_compensation' => $step->compensation !== null,
            ])->values(),
        ];
    }
}
