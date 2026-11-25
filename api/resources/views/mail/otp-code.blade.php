<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $purpose === 'register' ? 'Kode Verifikasi Pendaftaran' : 'Kode Verifikasi Login' }} — Console Hub</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f6f8;padding:32px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
                    <tr>
                        <td style="background-color:#0f172a;padding:24px 32px;">
                            <div style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">
                                Console Hub
                            </div>
                            <div style="font-size:12px;color:#94a3b8;margin-top:4px;">
                                Portal Multi-Console
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:32px;">
                            <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#111827;">
                                Halo, <strong>{{ $userName }}</strong>
                            </p>
                            <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4b5563;">
                                {{ $purpose === 'register'
                                    ? 'Gunakan kode verifikasi satu kali (OTP) berikut untuk menyelesaikan pendaftaran akun Console Hub Anda:'
                                    : 'Gunakan kode verifikasi satu kali (OTP) berikut untuk masuk ke akun Console Hub Anda:' }}
                            </p>

                            <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px 16px;text-align:center;margin:0 0 24px;">
                                <div style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:36px;font-weight:700;letter-spacing:0.35em;padding-left:0.35em;color:#0f172a;">
                                    {{ $otp }}
                                </div>
                            </div>

                            <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#374151;">
                                Kode ini berlaku selama <strong>{{ $expiresInMinutes }} menit</strong> dan hanya dapat digunakan satu kali.
                            </p>
                            <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
                                Demi keamanan akun Anda, jangan bagikan kode ini kepada siapa pun. Jika Anda tidak meminta kode verifikasi ini, silakan abaikan email ini.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;font-size:12px;color:#9ca3af;">
                            &copy; {{ date('Y') }} Console Hub. Email ini dikirim secara otomatis.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
