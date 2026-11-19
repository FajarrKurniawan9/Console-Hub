<?php

namespace App\Http\Requests;

use App\Connectors\HostGuard;
use App\Models\Console;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Shared validation for creating (POST) and updating (PATCH) a console.
 */
class ConsoleRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $console = $this->route('console');
        $creating = ! $console instanceof Console;
        $required = $creating ? 'required' : 'sometimes';

        return [
            'slug' => [$required, 'string', 'max:30', 'regex:/^[a-z0-9-]+$/', Rule::unique('consoles', 'slug')->ignore($console instanceof Console ? $console->id : null)],
            'name' => [$required, 'string', 'max:60'],
            'base_url' => [$required, 'string', 'max:255', 'url:http,https'],
            'auth_type' => ['sometimes', Rule::in(['api_key', 'bearer', 'basic'])],
            'service_key' => [$required, 'string', 'min:8', 'max:500'],
            'is_active' => ['sometimes', 'boolean'],
            'resource' => [$required, Rule::in(['items', 'productions', 'people']), Rule::unique('consoles', 'resource')->ignore($console instanceof Console ? $console->id : null)],
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                $baseUrl = $this->input('base_url');

                if (is_string($baseUrl) && ! $validator->errors()->has('base_url') && $reason = app(HostGuard::class)->violation($baseUrl)) {
                    $validator->errors()->add('base_url', $reason);
                }
            },
        ];
    }
}
