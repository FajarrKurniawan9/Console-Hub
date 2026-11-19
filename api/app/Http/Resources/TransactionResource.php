<?php

namespace App\Http\Resources;

use App\Models\Transaction;
use App\Models\TransactionParticipant;
use App\Support\Iso;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Frontend `Transaction` (admin view, with participants per console).
 *
 * @mixin Transaction
 */
class TransactionResource extends JsonResource
{
    private bool $withPayload = false;

    public function withPayload(): self
    {
        $this->withPayload = true;

        return $this;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $data = [
            'id' => $this->id,
            'operation' => $this->operation,
            'entity_type' => $this->entity_type,
            'entity_id' => $this->entity_id,
            'state' => $this->state,
            // System transactions (seed, CLI repair) have no requester.
            'requested_by' => $this->requester ? ['id' => $this->requester->id, 'name' => $this->requester->name] : ['id' => 0, 'name' => 'Sistem'],
            'created_at' => Iso::utc($this->created_at),
            'decided_at' => Iso::utc($this->decided_at),
            'finished_at' => Iso::utc($this->finished_at),
            'failure_code' => $this->failure_code,
            'failure_message' => $this->failure_message,
            'participants' => $this->participants
                ->sortBy('console_id')
                ->map(fn (TransactionParticipant $p) => array_filter([
                    'console' => ['slug' => $p->console->slug, 'name' => $p->console->name],
                    'prepare_state' => $p->prepare_state,
                    'decision_state' => $p->decision_state,
                    'refusal_code' => $p->refusal_code,
                    'refusal_message' => $p->refusal_message,
                    'attempts' => $p->attempts,
                    'last_error' => $p->last_error,
                    'prepared_at' => Iso::utc($p->prepared_at),
                    'finished_at' => Iso::utc($p->finished_at),
                    'latency_ms' => $p->latency_ms,
                    'version' => $p->version,
                ], fn ($v, $k) => $v !== null || in_array($k, ['last_error', 'prepared_at', 'finished_at', 'latency_ms', 'version'], true), ARRAY_FILTER_USE_BOTH))
                ->values()
                ->all(),
        ];

        if ($this->withPayload) {
            $data['payload'] = $this->payload;
        }

        return $data;
    }
}
