<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LogResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => (int) $this->id,
            'occurred_at' => $this->occurred_at?->toISOString(),
            'level' => (string) $this->level,
            'message' => (string) $this->message,
            'actor' => $this->actor ? (string) $this->actor : null,
        ];
    }
}
