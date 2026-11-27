<?php

namespace App\Http\Requests;

use App\Models\DataImport;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DataImportPreviewRequest extends FormRequest
{
    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', 'string', Rule::in(DataImport::TYPES)],
            'mode' => ['required', 'string', Rule::in(DataImport::MODES)],
            'file' => ['required', 'file', 'max:2048'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'type.required' => 'Tipe entitas impor wajib dipilih.',
            'type.in' => 'Tipe entitas impor harus salah satu dari: users, personel, produksi, barang.',
            'mode.required' => 'Mode impor wajib dipilih.',
            'mode.in' => 'Mode impor harus salah satu dari: create_only, upsert.',
            'file.required' => 'File CSV atau XLSX wajib diunggah.',
            'file.file' => 'Unggahan harus berupa file yang valid.',
            'file.max' => 'Ukuran file maksimal adalah 2 MB.',
        ];
    }
}
