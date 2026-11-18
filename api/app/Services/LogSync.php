<?php

namespace App\Services;

use App\Connectors\ConsoleClient;
use App\Connectors\Exceptions\ConsoleException;
use App\Connectors\LogMapper;
use App\Models\Console;
use App\Models\LogEntry;
use App\Models\LogSyncState;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;
use Throwable;

/**
 * Pulls logs from a console API, normalises and stores them without duplicates.
 */
class LogSync
{
    private const MAX_PAGES = 20;

    private const BATCH_SIZE = 500;

    public function __construct(private ConsoleClient $client, private LogMapper $mapper) {}

    /**
     * @return array{console: Console, status: 'ok'|'failed', inserted: int, error: string|null}
     */
    public function syncConsole(Console $console): array
    {
        $state = LogSyncState::query()->firstOrNew(['console_id' => $console->id]);
        $state->last_synced_at = now();

        try {
            if (! $console->setting('logs.path')) {
                throw new InvalidArgumentException("{$console->name} tidak punya konfigurasi logs.");
            }

            [$entries, $cursor] = match ($console->setting('logs.pagination', 'none')) {
                'page' => [$this->pullPages($console, $state), $state->cursor ?? []],
                'since' => $this->pullSince($console, $state),
                default => [$this->fetch($console), $state->cursor ?? []],
            };

            $inserted = $this->store($console, $entries);

            $state->fill(['cursor' => $cursor, 'last_success_at' => now(), 'last_error' => null])->save();

            return ['console' => $console, 'status' => 'ok', 'inserted' => $inserted, 'error' => null];
        } catch (ConsoleException|InvalidArgumentException $e) {
            $message = $e->getMessage();
        } catch (Throwable $e) {
            Log::error('Log sync failed', ['console' => $console->slug, 'exception' => $e::class, 'message' => $e->getMessage()]);
            $message = "Gagal menarik log dari {$console->name}.";
        }

        $state->fill(['last_error' => $message])->save();

        return ['console' => $console, 'status' => 'failed', 'inserted' => 0, 'error' => $message];
    }

    /**
     * Fetch pages until one is empty, the whole page predates the last success (minus 2 minutes), or MAX_PAGES.
     *
     * @return list<array{occurred_at: CarbonImmutable, level: string, message: string, actor: string|null, raw: array<string, mixed>}>
     */
    private function pullPages(Console $console, LogSyncState $state): array
    {
        $logs = (array) $console->setting('logs');
        $threshold = $state->last_success_at ? CarbonImmutable::instance($state->last_success_at)->subMinutes(2) : null;
        $all = [];

        for ($page = 1; $page <= self::MAX_PAGES; $page++) {
            $entries = $this->fetch($console, [
                $logs['page_param'] ?? 'page' => $page,
                $logs['per_page_param'] ?? 'per_page' => $logs['per_page'] ?? 50,
            ]);

            if ($entries === []) {
                break;
            }

            array_push($all, ...$entries);

            if ($threshold && collect($entries)->every(fn (array $e) => $e['occurred_at']->lessThan($threshold))) {
                break;
            }
        }

        return $all;
    }

    /**
     * @return array{0: list<array{occurred_at: CarbonImmutable, level: string, message: string, actor: string|null, raw: array<string, mixed>}>, 1: array<string, mixed>}
     */
    private function pullSince(Console $console, LogSyncState $state): array
    {
        $since = (array) $console->setting('logs.since', []);
        $cursor = $state->cursor ?? [];
        $from = isset($cursor['since']) ? CarbonImmutable::parse($cursor['since']) : now()->toImmutable()->subDay();
        $value = ($since['format'] ?? 'epoch_seconds') === 'epoch_seconds' ? $from->getTimestamp() : $from->utc()->toIso8601ZuluString();

        $entries = $this->fetch($console, [$since['param'] ?? 'since' => $value]);
        $max = collect($entries)->max(fn (array $e) => $e['occurred_at']);

        return [$entries, $max ? ['since' => $max->toIso8601ZuluString()] : $cursor];
    }

    /**
     * @param  array<string, mixed>  $query
     * @return list<array{occurred_at: CarbonImmutable, level: string, message: string, actor: string|null, raw: array<string, mixed>}>
     */
    private function fetch(Console $console, array $query = []): array
    {
        $response = $this->client->request($console, 'GET', (string) $console->setting('logs.path'), null, ['query' => $query, 'throw' => true]);
        $list = $response->get($console->setting('logs.list_path'));

        if (! is_array($list) || ! array_is_list($list)) {
            throw new InvalidArgumentException("Respons log {$console->name} tidak berisi daftar entri.");
        }

        return array_values(array_filter(array_map(
            fn ($entry) => is_array($entry) ? $this->mapper->map($console, $entry) : null,
            $list,
        )));
    }

    /**
     * @param  list<array{occurred_at: CarbonImmutable, level: string, message: string, actor: string|null, raw: array<string, mixed>}>  $entries
     */
    private function store(Console $console, array $entries): int
    {
        $now = now();
        $inserted = 0;

        foreach (array_chunk($entries, self::BATCH_SIZE) as $chunk) {
            $rows = array_map(fn (array $e) => [
                'console_id' => $console->id,
                'occurred_at' => $e['occurred_at'],
                'level' => $e['level'],
                'message' => $e['message'],
                'actor' => $e['actor'],
                'dedupe_key' => LogMapper::dedupeKey($console->id, $e['occurred_at'], $e['message']),
                'raw' => json_encode($e['raw'], JSON_UNESCAPED_UNICODE),
                'ingested_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ], $chunk);

            $inserted += LogEntry::query()->insertOrIgnore($rows);
        }

        return $inserted;
    }
}
