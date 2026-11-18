<?php

namespace App\Http\Resources;

use App\Models\RunStep;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin RunStep
 */
class RunStepResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'position' => $this->position,
            'name' => $this->name,
            'console' => $this->console ? ['slug' => $this->console->slug] : null,
            'status' => $this->status,
            'attempt' => $this->attempt,
            $this->mergeWhen($this->request !== null, fn () => ['request' => $this->request]),
            $this->mergeWhen($this->response_status !== null, fn () => ['response' => ['status' => $this->response_status, 'body' => $this->response_body]]),
            'error' => $this->error,
            'duration_ms' => $this->duration_ms,
        ];
    }
}
