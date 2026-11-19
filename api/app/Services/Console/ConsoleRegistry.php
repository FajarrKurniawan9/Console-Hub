<?php

namespace App\Services\Console;

use App\Connectors\ConsoleClient;
use App\Models\Console;
use App\Support\ApiException;
use Illuminate\Database\Eloquent\Collection;
use RuntimeException;

/**
 * Which consoles take part in a write, and which one owns each kind of data.
 */
class ConsoleRegistry
{
    /** Every write on shared data must reach these three. */
    public const SLUGS = ['hr', 'gudang', 'produksi'];

    public function __construct(private ConsoleClient $client) {}

    /**
     * @return Collection<int, Console>
     */
    public function participants(): Collection
    {
        $consoles = Console::query()->whereIn('slug', self::SLUGS)->orderBy('id')->get();

        if ($consoles->count() !== count(self::SLUGS)) {
            throw new RuntimeException('Console hr, gudang, dan produksi harus terdaftar. Jalankan db:seed.');
        }

        return $consoles;
    }

    /**
     * @param  'divisions'|'employees'|'items'|'orders'  $resource
     */
    public function owner(string $resource): Console
    {
        return Console::query()->whereRaw('? = ANY(is_owner_of)', [$resource])->orderBy('id')->first()
            ?? throw new RuntimeException("Tidak ada console pemilik untuk {$resource}.");
    }

    /**
     * Read one record from its owner console (`GET /internal/v1/{resource}/{id}`).
     *
     * @return array<string, mixed>
     */
    public function readOwned(string $resource, string $id): array
    {
        $owner = $this->owner($resource);
        $response = $this->client->request($owner, 'GET', "/internal/v1/{$resource}/".rawurlencode($id));

        if ($response->status === 404) {
            throw new ApiException(404, 'NOT_FOUND', 'Data tidak ditemukan.');
        }

        if (! $response->successful() || ! is_array($response->get('data'))) {
            throw $this->client->errorFor($owner, $response);
        }

        return $response->get('data');
    }
}
