<?php

namespace App\Http\Resources;

use App\Models\Console;
use App\Support\Iso;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Console
 */
class ConsoleResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'base_url' => $this->base_url,
            'auth_type' => $this->auth_type,
            'timezone' => $this->timezone,
            'is_active' => $this->is_active,
            'status' => $this->status,
            'last_latency_ms' => $this->last_latency_ms,
            'last_checked_at' => Iso::utc($this->last_checked_at),
            'last_error' => $this->lastError(),
            'resources' => collect((array) $this->setting('resources', []))
                ->map(fn (array $resource) => [
                    'key' => $resource['key'],
                    'label' => $resource['label'] ?? $resource['key'],
                    'writable_fields' => array_values($resource['writable_fields'] ?? []),
                ])->values(),
        ];
    }

    private function lastError(): ?string
    {
        $syncError = $this->relationLoaded('syncState') ? $this->syncState?->last_error : $this->syncState()->value('last_error');

        if ($syncError) {
            return $syncError;
        }

        if ($this->status !== 'down') {
            return null;
        }

        $check = $this->relationLoaded('latestHealthCheck') ? $this->latestHealthCheck : $this->latestHealthCheck()->first();

        return $check?->message;
    }
}
