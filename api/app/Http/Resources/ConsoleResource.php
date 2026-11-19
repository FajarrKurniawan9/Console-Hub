<?php

namespace App\Http\Resources;

use App\Models\Console;
use App\Services\HealthChecker;
use App\Support\Iso;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Frontend `ConsoleInfo`. The service key is never part of it.
 *
 * @mixin Console
 */
class ConsoleResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $health = HealthChecker::summarize($this->resource);

        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'base_url' => $this->base_url,
            'is_active' => $this->is_active,
            'status' => $health['status'],
            'latency_ms' => $health['last_latency_ms'],
            'last_checked_at' => Iso::utc($health['last_checked_at']),
            // Extra fields for the admin screen; the frontend schema ignores them.
            'last_error' => $health['last_error'],
            'resource' => $this->resource,
            'auth_type' => $this->auth_type,
            'has_service_key' => $this->service_key !== null && $this->service_key !== '',
        ];
    }
}
