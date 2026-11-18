<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class LogSyncRequest extends FormRequest
{
    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'console_id' => ['nullable', 'integer', 'exists:consoles,id'],
        ];
    }
}
