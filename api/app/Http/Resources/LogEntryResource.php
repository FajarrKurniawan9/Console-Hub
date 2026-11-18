<?php

namespace App\Http\Resources;

use App\Models\LogEntry;
use App\Support\Iso;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin LogEntry
 */
class LogEntryResource extends JsonResource
{
    private bool $withRaw = false;

    public function withRaw(): self
    {
        $this->withRaw = true;

        return $this;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'console' => ['id' => $this->console->id, 'slug' => $this->console->slug, 'name' => $this->console->name],
            'occurred_at' => Iso::utc($this->occurred_at),
            'level' => $this->level,
            'message' => $this->message,
            'actor' => $this->actor,
            $this->mergeWhen($this->withRaw, fn () => ['raw' => $this->raw]),
        ];
    }
}
