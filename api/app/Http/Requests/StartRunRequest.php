<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StartRunRequest extends FormRequest
{
    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'input' => ['present', 'array'],
        ];
    }
}
