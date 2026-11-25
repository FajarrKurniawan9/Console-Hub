<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RequestOtpRequest extends FormRequest
{
    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        $recaptchaRule = config('services.recaptcha.enabled') ? 'required_without:resend_token' : 'nullable';

        return [
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
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'recaptcha_token.required' => 'Verifikasi reCAPTCHA wajib diselesaikan.',
            'recaptcha_token.required_without' => 'Verifikasi reCAPTCHA wajib diselesaikan.',
        ];
    }
}
