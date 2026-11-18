<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RunIndexRequest extends FormRequest
{
    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'process_id' => ['nullable', 'string', 'regex:/^\d+(,\d+)*$/'],
            'status' => ['nullable', 'string', 'regex:/^(queued|running|succeeded|failed|canceled)(,(queued|running|succeeded|failed|canceled))*$/'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
            'cursor' => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * @return list<string>
     */
    public function csv(string $key): array
    {
        return array_values(array_filter(explode(',', (string) $this->query($key, ''))));
    }
}
