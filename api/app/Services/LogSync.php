<?php

namespace App\Services;

use App\Connectors\ConsoleClient;
use App\Connectors\Exceptions\ConsoleException;
use App\Models\Console;
use App\Models\LogEntry;
use App\Models\LogSyncState;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;
use Throwable;

/**
 * Pulls `GET /internal/v1/logs?since=&cursor=&limit=` from a console and stores entries idempotently.
 * Console log entries are uniform: {occurred_at, level, message, actor, tx_id}.
 */
class LogSync
{
    public const LEVELS = ['debug', 'info', 'warn', 'error'];

    private const MAX_PAGES = 20;

    private const PAGE_SIZE = 200;

    public function __construct(private ConsoleClient $client) {}

    /**
     * @return array{console: Console, status: 'ok'|'failed', inserted: int|null, error: string|null}
     */
    public function syncConsole(Console $console): array
    {
        $state = LogSyncState::query()->firstOrNew(['console_id' => $console->id]);

        try {
            $since = $state->last_synced_at?->toImmutable()->subMinutes(2) ?? now()->toImmutable()->subDay();
            $cursor = null;
            $inserted = 0;

            for ($page = 0; $page < self::MAX_PAGES; $page++) {
                $response = $this->client->request($console, 'GET', '/internal/v1/logs', null, [
                    'throw' => true,
                    'query' => array_filter(['since' => $since->utc()->toIso8601ZuluString(), 'cursor' => $cursor, 'limit' => self::PAGE_SIZE]),
                ]);

                $entries = $response->get('data');

                if (! is_array($entries) || ! array_is_list($entries)) {
                    throw new InvalidArgumentException("Respons log {$console->name} tidak berisi daftar entri.");
                }

                $inserted += $this->store($console, $entries);
                $cursor = $response->get('meta.next_cursor');

                if (! is_string($cursor) || $cursor === '') {
                    break;
                }
            }

            $state->fill(['last_synced_at' => now(), 'last_cursor' => is_string($cursor) ? $cursor : null, 'last_error' => null])->save();

            return ['console' => $console, 'status' => 'ok', 'inserted' => $inserted, 'error' => null];
        } catch (ConsoleException|InvalidArgumentException $e) {
            $message = $e->getMessage();
        } catch (Throwable $e) {
            Log::error('Log sync failed', ['console' => $console->slug, 'exception' => $e::class, 'message' => $e->getMessage()]);
            $message = "Gagal menarik log dari {$console->name}.";
        }

        $state->fill(['last_error' => $message])->save();

        return ['console' => $console, 'status' => 'failed', 'inserted' => null, 'error' => $message];
    }

    public static function fingerprint(int $consoleId, CarbonImmutable $occurredAt, string $message, ?string $actor): string
    {
        return sha1($consoleId.'|'.$occurredAt->utc()->format('Y-m-d\TH:i:s.u\Z').'|'.$message.'|'.($actor ?? ''));
    }

    /**
     * @param  list<mixed>  $entries
     */
    private function store(Console $console, array $entries): int
    {
        $rows = [];

        foreach ($entries as $entry) {
            if (! is_array($entry) || ! isset($entry['occurred_at'], $entry['message'])) {
                continue;
            }

            try {
                $occurredAt = CarbonImmutable::parse((string) $entry['occurred_at'])->utc();
            } catch (Throwable) {
                continue;
            }

            $message = (string) $entry['message'];
            $actor = isset($entry['actor']) && $entry['actor'] !== '' ? mb_substr((string) $entry['actor'], 0, 100) : null;
            $level = strtolower((string) ($entry['level'] ?? 'info'));
            $txId = isset($entry['tx_id']) && preg_match('/^[0-9a-f-]{36}$/i', (string) $entry['tx_id']) ? (string) $entry['tx_id'] : null;

            $rows[] = [
                'console_id' => $console->id,
                'occurred_at' => $occurredAt,
                'level' => in_array($level, self::LEVELS, true) ? $level : ($level === 'warning' ? 'warn' : 'info'),
                'message' => $message,
                'actor' => $actor,
                'tx_id' => $txId,
                'raw' => json_encode($entry, JSON_UNESCAPED_UNICODE),
                'fingerprint' => self::fingerprint($console->id, $occurredAt, $message, $actor),
            ];
        }

        return $rows === [] ? 0 : LogEntry::query()->insertOrIgnore($rows);
    }
}
