<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Validates a full process definition (create and replace).
 */
class ProcessRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $methods = Rule::in(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

        return [
            'name' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['sometimes', 'boolean'],
            'compensate_on_failure' => ['sometimes', 'boolean'],
            'input_schema' => ['present', 'array'],
            'input_schema.*.type' => ['required', Rule::in(['string', 'integer'])],
            'input_schema.*.label' => ['required', 'string', 'max:100'],
            'input_schema.*.required' => ['sometimes', 'boolean'],
            'input_schema.*.min' => ['sometimes', 'integer'],
            'steps' => ['required', 'array', 'min:1'],
            'steps.*.position' => ['required', 'integer', 'min:1', 'distinct'],
            'steps.*.name' => ['required', 'string', 'max:150'],
            'steps.*.console' => ['required', 'string', Rule::exists('consoles', 'slug')],
            'steps.*.method' => ['required', $methods],
            'steps.*.path' => ['required', 'string', 'starts_with:/', 'max:500'],
            'steps.*.body' => ['nullable', 'array'],
            'steps.*.expect_status' => ['sometimes', 'array', 'min:1'],
            'steps.*.expect_status.*' => ['integer', 'between:100,599'],
            'steps.*.timeout_seconds' => ['sometimes', 'integer', 'between:1,60'],
            'steps.*.max_retries' => ['sometimes', 'integer', 'between:0,3'],
            'steps.*.on_failure' => ['sometimes', Rule::in(['stop', 'continue'])],
            'steps.*.compensation' => ['nullable', 'array'],
            'steps.*.compensation.method' => ['required_with:steps.*.compensation', $methods],
            'steps.*.compensation.path' => ['required_with:steps.*.compensation', 'string', 'starts_with:/'],
            'steps.*.compensation.body' => ['nullable', 'array'],
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                foreach ((array) $this->input('steps', []) as $i => $step) {
                    if (str_contains((string) json_encode($step), '{{secret.')) {
                        $validator->errors()->add("steps.{$i}", 'Templat {{secret.*}} tidak boleh dipakai di langkah proses.');
                    }
                }
            },
        ];
    }
}
