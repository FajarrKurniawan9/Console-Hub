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
        $authType = $this->input('auth_type', $console instanceof Console ? $console->auth_type : null);
        $credentialsRequired = $creating || $this->has('auth_type') ? 'required' : 'sometimes';

        return [
            'slug' => [$required, 'string', 'max:50', 'regex:/^[a-z0-9-]+$/', Rule::unique('consoles', 'slug')->ignore($console instanceof Console ? $console->id : null)],
            'name' => [$required, 'string', 'max:100'],
            'base_url' => [$required, 'string', 'max:255', 'url:http,https'],
            'auth_type' => [$required, Rule::in(['api_key', 'bearer', 'basic'])],
            'credentials' => [$credentialsRequired, 'array'],
            'credentials.header' => [Rule::requiredIf($authType === 'api_key' && $this->has('credentials')), 'string', 'max:100'],
            'credentials.key' => [Rule::requiredIf($authType === 'api_key' && $this->has('credentials')), 'string'],
            'credentials.username' => [Rule::requiredIf(in_array($authType, ['bearer', 'basic'], true) && $this->has('credentials')), 'string'],
            'credentials.password' => [Rule::requiredIf(in_array($authType, ['bearer', 'basic'], true) && $this->has('credentials')), 'string'],
            'config' => [$required, 'array'],
            'config.health' => ['sometimes', 'array'],
            'config.health.path' => ['sometimes', 'string', 'starts_with:/'],
            'config.logs' => ['sometimes', 'array'],
            'config.logs.path' => ['required_with:config.logs', 'string', 'starts_with:/'],
            'config.logs.pagination' => ['required_with:config.logs', Rule::in(['page', 'since', 'none'])],
            'config.logs.map' => ['required_with:config.logs', 'array'],
            'config.resources' => ['sometimes', 'array'],
            'config.resources.*.key' => ['required', 'string', 'distinct'],
            'config.resources.*.label' => ['required', 'string'],
            'config.resources.*.list_path' => ['required', 'string', 'starts_with:/'],
            'config.resources.*.item_path' => ['required', 'string', 'starts_with:/'],
            'config.resources.*.id_field' => ['required', 'string'],
            'config.resources.*.update_method' => ['sometimes', Rule::in(['PATCH', 'PUT', 'POST'])],
            'config.resources.*.writable_fields' => ['required', 'array'],
            'config.resources.*.writable_fields.*' => ['string'],
            'timezone' => ['sometimes', 'timezone:all'],
            'is_active' => ['sometimes', 'boolean'],
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
