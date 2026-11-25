<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RegisterRequestOtpRequest extends FormRequest
{
    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        $recaptchaRule = config('services.recaptcha.enabled') ? 'required_without:resend_token' : 'nullable';

        return [
            'name' => ['required', 'string', 'min:3', 'max:100'],
            'email' => ['required', 'email', 'max:150'],
            'recaptcha_token' => ['nullable', $recaptchaRule, 'string'],
            'resend_token' => ['nullable', 'string', 'max:128'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Nama lengkap wajib diisi.',
            'name.min' => 'Nama lengkap minimal 3 huruf.',
            'name.max' => 'Nama lengkap maksimal 100 karakter.',
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'email.max' => 'Email maksimal 150 karakter.',
            'recaptcha_token.required' => 'Verifikasi reCAPTCHA wajib diselesaikan.',
            'recaptcha_token.required_without' => 'Verifikasi reCAPTCHA wajib diselesaikan.',
        ];
    }
}
