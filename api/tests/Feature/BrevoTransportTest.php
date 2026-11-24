<?php

use App\Mail\OtpCodeMail;
use App\Mail\Transport\BrevoTransport;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

beforeEach(function () {
    config([
        'services.brevo.api_key' => 'xkeysib-test-secret-key',
        'mail.from.address' => 'noreply@consolehub.test',
        'mail.from.name' => 'Console Hub',
    ]);

    Mail::purge('brevo');
});

it('sends an OTP email through the brevo mailer using Brevo HTTP API v3', function () {
    Http::fake([
        'https://api.brevo.com/v3/smtp/email' => Http::response(['messageId' => '<msg-123@brevo.test>'], 201),
    ]);

    Mail::mailer('brevo')
        ->to('budi@example.com')
        ->send(new OtpCodeMail('482910', 'Budi Santoso'));

    Http::assertSent(function (Request $request): bool {
        $payload = $request->data();

        return $request->method() === 'POST'
            && $request->url() === 'https://api.brevo.com/v3/smtp/email'
            && $request->hasHeader('api-key', 'xkeysib-test-secret-key')
            && $request->hasHeader('accept', 'application/json')
            && ($payload['sender'] ?? null) === [
                'email' => 'noreply@consolehub.test',
                'name' => 'Console Hub',
            ]
            && ($payload['to'] ?? null) === [
                ['email' => 'budi@example.com'],
            ]
            && ($payload['subject'] ?? null) === 'Kode Verifikasi Login — Console Hub'
            && is_string($payload['htmlContent'] ?? null)
            && str_contains($payload['htmlContent'], '482910')
            && str_contains($payload['htmlContent'], 'Budi Santoso')
            && ! array_key_exists('textContent', $payload);
    });
});

it('formats named recipients, textContent, and mail.from fallback properly', function () {
    Http::fake([
        'https://api.brevo.com/v3/smtp/email' => Http::response(['messageId' => '<msg-456@brevo.test>'], 201),
    ]);

    $transport = new BrevoTransport('xkeysib-direct-key');

    expect((string) $transport)->toBe('brevo');

    $email = (new Email)
        ->sender('envelope@consolehub.test')
        ->to(new Address('siti@example.com', 'Siti Aminah'), new Address('andi@example.com'))
        ->subject('Notifikasi Sistem')
        ->html('<p>Halo <strong>Siti</strong></p>')
        ->text('Halo Siti');

    $envelope = new Envelope(
        new Address('envelope@consolehub.test'),
        [new Address('siti@example.com'), new Address('andi@example.com')],
    );

    $transport->send($email, $envelope);

    Http::assertSent(function (Request $request): bool {
        $payload = $request->data();

        return $request->hasHeader('api-key', 'xkeysib-direct-key')
            && ($payload['sender'] ?? null) === [
                'email' => 'noreply@consolehub.test',
                'name' => 'Console Hub',
            ]
            && ($payload['to'] ?? null) === [
                ['email' => 'siti@example.com', 'name' => 'Siti Aminah'],
                ['email' => 'andi@example.com'],
            ]
            && ($payload['subject'] ?? null) === 'Notifikasi Sistem'
            && ($payload['htmlContent'] ?? null) === '<p>Halo <strong>Siti</strong></p>'
            && ($payload['textContent'] ?? null) === 'Halo Siti';
    });
});

it('uses explicit From address and name over mail.from defaults', function () {
    Http::fake([
        'https://api.brevo.com/v3/smtp/email' => Http::response(['messageId' => '<msg-789@brevo.test>'], 201),
    ]);

    $transport = new BrevoTransport('xkeysib-direct-key');

    $email = (new Email)
        ->from(new Address('security@consolehub.test', 'Console Hub Security'))
        ->to('budi@example.com')
        ->subject('Alert')
        ->text('Login detected');

    $transport->send($email);

    Http::assertSent(function (Request $request): bool {
        $payload = $request->data();

        return ($payload['sender'] ?? null) === [
            'email' => 'security@consolehub.test',
            'name' => 'Console Hub Security',
        ]
            && ($payload['textContent'] ?? null) === 'Login detected'
            && ! array_key_exists('htmlContent', $payload);
    });
});

it('throws TransportException when Brevo API returns a non-2xx response', function (int $status, array $body) {
    Http::fake([
        'https://api.brevo.com/v3/smtp/email' => Http::response($body, $status),
    ]);

    expect(fn () => Mail::mailer('brevo')
        ->to('budi@example.com')
        ->send(new OtpCodeMail('123456', 'Budi Santoso')))
        ->toThrow(function (TransportException $exception) use ($status, $body): void {
            expect($exception->getCode())->toBe($status)
                ->and($exception->getMessage())->toContain((string) $status)
                ->and($exception->getMessage())->toContain($body['message'])
                ->and($exception->getMessage())->not->toContain('xkeysib-test-secret-key');
        });
})->with([
    'unauthorized 401' => [401, ['code' => 'unauthorized', 'message' => 'Key not found']],
    'bad request 400' => [400, ['code' => 'invalid_parameter', 'message' => 'sender is not valid']],
]);

it('throws TransportException when connecting to Brevo API fails', function () {
    Http::fake([
        'https://api.brevo.com/v3/smtp/email' => Http::failedConnection(),
    ]);

    expect(fn () => Mail::mailer('brevo')
        ->to('budi@example.com')
        ->send(new OtpCodeMail('123456', 'Budi Santoso')))
        ->toThrow(TransportException::class, 'Brevo API connection failed');
});
