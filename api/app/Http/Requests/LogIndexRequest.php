<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class LogIndexRequest extends FormRequest
{
    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'console_id' => ['nullable', 'string', 'regex:/^\d+(,\d+)*$/'],
            'level' => ['nullable', 'string', 'regex:/^(debug|info|warn|error)(,(debug|info|warn|error))*$/'],
            'q' => ['nullable', 'string', 'max:200'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
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
