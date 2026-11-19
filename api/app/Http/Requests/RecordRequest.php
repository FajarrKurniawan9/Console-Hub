<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Shape checks for POST and PATCH of items, productions and people (contract §2-4), before any source
 * is called. The resource comes from the route default `resource`.
 */
class RecordRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $creating = $this->isMethod('POST');
        $required = $creating ? 'required' : 'sometimes';

        $rules = match ($this->route()?->defaults['resource'] ?? null) {
            'items' => [
                'name' => [$required, 'string', 'min:2', 'max:120'],
                'kind' => [$required, 'string', 'min:2', 'max:60'],
                'production_id' => ['sometimes', 'nullable', 'uuid'],
                'responsible_id' => ['sometimes', 'nullable', 'uuid'],
                'quantity' => ['sometimes', 'integer', 'min:0'],
                'unit' => ['sometimes', 'string', 'min:1', 'max:20'],
            ],
            'productions' => [
                'area' => [$required, 'string', 'min:2', 'max:80'],
                'production_type' => [$required, 'string', 'min:2', 'max:80'],
                'courier_id' => ['sometimes', 'nullable', 'uuid'],
            ],
            default => [
                'name' => [$required, 'string', 'min:2', 'max:120'],
                'role' => [$required, 'string', 'min:2', 'max:60'],
            ],
        };

        return $creating ? $rules : [...$rules, 'expected_version' => ['required', 'integer', 'min:1']];
    }
}
