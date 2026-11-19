<?php

namespace App\Services\Sources;

use App\Connectors\ConsoleClient;
use App\Models\Console;

/**
 * Maps each resource to the source API that owns it, from the `consoles` table.
 */
class SourceRegistry
{
    /** Resource => source slug (fixed by the contract). */
    public const SOURCES = ['items' => 'gudang', 'productions' => 'produksi', 'people' => 'hr'];

    /** @var array<string, SourceClient> */
    private array $clients = [];

    public function __construct(private ConsoleClient $client) {}

    public function items(): SourceClient
    {
        return $this->for('items');
    }

    public function productions(): SourceClient
    {
        return $this->for('productions');
    }

    public function people(): SourceClient
    {
        return $this->for('people');
    }

    /**
     * @param  'items'|'productions'|'people'  $resource
     */
    public function for(string $resource): SourceClient
    {
        return $this->clients[$resource] ??= new SourceClient(
            self::SOURCES[$resource],
            $resource,
            Console::query()->where('resource', $resource)->first(),
            $this->client,
        );
    }

    /**
     * Run GETs on several sources in parallel.
     *
     * @param  array<string, array{0: SourceClient, 1: string, 2: bool}>  $gets  key => [client, path, single record?]
     * @return array<string, SourceResult>
     */
    public function getMany(array $gets): array
    {
        $results = [];
        $sendable = [];

        foreach ($gets as $key => [$source, $path]) {
            $console = $source->console();

            if ($console === null) {
                $results[$key] = new SourceResult($source->source, 'unavailable', error: $source->missing());
            } else {
                $sendable[$key] = [$console, $path];
            }
        }

        foreach ($this->client->pool($sendable) as $key => $response) {
            $results[$key] = $gets[$key][0]->result($response, $gets[$key][2]);
        }

        return $results;
    }
}
