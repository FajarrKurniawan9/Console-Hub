<?php

namespace App\Mail\Transport;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Message;
use Symfony\Component\Mime\MessageConverter;

class BrevoTransport extends AbstractTransport
{
    public function __construct(
        private readonly string $apiKey,
        private readonly string $endpoint = 'https://api.brevo.com/v3/smtp/email',
    ) {
        parent::__construct();
    }

    protected function doSend(SentMessage $message): void
    {
        $original = $message->getOriginalMessage();

        if (! $original instanceof Message) {
            throw new TransportException('Brevo transport requires a MIME Message instance.');
        }

        $email = MessageConverter::toEmail($original);

        $from = $email->getFrom()[0] ?? null;
        $senderEmail = $from?->getAddress() ?: (string) config('mail.from.address', '');
        $senderName = $from?->getName() ?: (string) config('mail.from.name', '');

        $sender = ['email' => $senderEmail];

        if ($senderName !== '') {
            $sender['name'] = $senderName;
        }

        $to = array_values(array_map(
            /** @return array{email: string, name?: string} */
            static function (Address $address): array {
                $recipient = ['email' => $address->getAddress()];

                if ($address->getName() !== '') {
                    $recipient['name'] = $address->getName();
                }

                return $recipient;
            },
            $email->getTo(),
        ));

        $payload = [
            'sender' => $sender,
            'to' => $to,
            'subject' => $email->getSubject() ?? '',
        ];

        $htmlContent = $this->normalizeBody($email->getHtmlBody());

        if ($htmlContent !== null && $htmlContent !== '') {
            $payload['htmlContent'] = $htmlContent;
        }

        $textContent = $this->normalizeBody($email->getTextBody());

        if ($textContent !== null && $textContent !== '') {
            $payload['textContent'] = $textContent;
        }

        try {
            $response = Http::withHeaders([
                'api-key' => $this->apiKey,
                'accept' => 'application/json',
            ])
                ->asJson()
                ->timeout(10)
                ->post($this->endpoint, $payload);
        } catch (ConnectionException $exception) {
            throw new TransportException(
                'Brevo API connection failed: '.$exception->getMessage(),
                0,
                $exception,
            );
        }

        if ($response->failed()) {
            $bodySummary = Str::limit(trim($response->body()), 500);

            throw new TransportException(
                sprintf(
                    'Brevo API error (HTTP %d): %s',
                    $response->status(),
                    $bodySummary !== '' ? $bodySummary : 'empty response body',
                ),
                $response->status(),
            );
        }
    }

    public function __toString(): string
    {
        return 'brevo';
    }

    /**
     * @param  resource|string|null  $body
     */
    private function normalizeBody(mixed $body): ?string
    {
        if (is_string($body)) {
            return $body;
        }

        if (is_resource($body)) {
            $contents = stream_get_contents($body);

            return is_string($contents) ? $contents : null;
        }

        return null;
    }
}
