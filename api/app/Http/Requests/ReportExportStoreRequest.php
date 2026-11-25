<?php

namespace App\Http\Requests;

use App\Models\ReportExport;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReportExportStoreRequest extends FormRequest
{
    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', 'string', Rule::in(ReportExport::TYPES)],
            'format' => ['nullable', 'string', Rule::in(ReportExport::FORMATS)],
            'name' => ['nullable', 'string', 'max:160'],
            'filters' => ['nullable', 'array'],
        ];
    }
}
