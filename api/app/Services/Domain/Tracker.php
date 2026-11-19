<?php

namespace App\Services\Domain;

use App\Services\Sources\SourceRegistry;
use App\Services\Sources\SourceResult;
use App\Support\ApiException;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\Log;

/**
 * Lacak Barang (update 1 §8): the item from Gudang, then its production (Produksi) and responsible
 * person (HR) in parallel, then the courier (HR). A dead Produksi or HR becomes a warning.
 */
class Tracker
{
    public function __construct(private SourceRegistry $sources) {}

    /**
     * @return array{item: array<string, mixed>, production: array<string, mixed>|null, responsible: array<string, string>|null, courier: array<string, string>|null, warnings: list<string>, sources: list<array{source: string, status: string, latency_ms: int|null}>}
     */
    public function track(string $itemId): array
    {
        $gudang = $this->sources->items()->find($itemId);

        if ($gudang->status === 'not_found') {
            throw new ApiException(404, 'NOT_FOUND', 'Barang tidak ditemukan.');
        }

        $item = $gudang->orFail();
        $status = ['gudang' => $gudang, 'produksi' => null, 'hr' => []];

        $gets = [];

        if ($productionId = $this->id($item['production_id'] ?? null)) {
            $gets['production'] = [$this->sources->productions(), $this->sources->productions()->path($productionId), true];
        }

        if ($responsibleId = $this->id($item['responsible_id'] ?? null)) {
            $gets['responsible'] = [$this->sources->people(), $this->sources->people()->path($responsibleId), true];
        }

        $first = $gets === [] ? [] : $this->sources->getMany($gets);
        $production = null;
        $responsible = null;
        $courier = null;

        if (isset($first['production'])) {
            $status['produksi'] = $first['production'];
            $production = $first['production']->ok() ? $first['production']->data : null;
        }

        if (isset($first['responsible'])) {
            $status['hr'][] = $first['responsible'];
            $responsible = $first['responsible']->ok() ? Enricher::ref('people', $first['responsible']->data) : null;
        }

        if ($production !== null && ($courierId = $this->id($production['courier_id'] ?? null))) {
            $result = $this->sources->people()->find($courierId);
            $status['hr'][] = $result;
            $courier = $result->ok() ? Enricher::ref('people', $result->data) : null;
        }

        if ($production !== null) {
            $production['courier'] = $courier;
        }

        $item['production'] = $production === null ? null : Enricher::ref('productions', $production);
        $item['responsible'] = $responsible;

        $sources = [
            $this->summary('gudang', [$gudang]),
            $this->summary('produksi', array_filter([$status['produksi']])),
            $this->summary('hr', $status['hr']),
        ];

        Log::info('Lacak Barang', [
            'request_id' => Context::get('request_id'),
            'item_id' => $itemId,
            'sources' => array_column($sources, 'status', 'source'),
        ]);

        return [
            'item' => $item,
            'production' => $production,
            'responsible' => $responsible,
            'courier' => $courier,
            'warnings' => $this->warnings($status['produksi'], $status['hr']),
            'sources' => $sources,
        ];
    }

    /**
     * Everyday sentences, in source order Produksi then HR (Gudang is never a warning: it is a 502).
     *
     * @param  list<SourceResult>  $hr
     * @return list<string>
     */
    private function warnings(?SourceResult $produksi, array $hr): array
    {
        $warnings = [];

        if ($produksi?->unavailable()) {
            $warnings[] = 'Data produksi sedang tidak tersedia.';
        } elseif ($produksi?->status === 'not_found') {
            $warnings[] = 'Asal produksi tidak ditemukan.';
        }

        if (array_filter($hr, fn (SourceResult $r) => $r->unavailable()) !== []) {
            $warnings[] = 'Data personel sedang tidak tersedia.';
        } elseif (array_filter($hr, fn (SourceResult $r) => $r->status === 'not_found') !== []) {
            $warnings[] = 'Data personel tidak ditemukan.';
        }

        return $warnings;
    }

    /**
     * One `SourceStatus`: worst status of the calls made, latency summed. No call: ok, latency null.
     *
     * @param  array<int, SourceResult>  $results
     * @return array{source: string, status: string, latency_ms: int|null}
     */
    private function summary(string $source, array $results): array
    {
        $statuses = array_map(fn (SourceResult $r) => $r->status, $results);
        $latencies = array_filter(array_map(fn (SourceResult $r) => $r->latencyMs, $results), fn ($l) => $l !== null);

        return [
            'source' => $source,
            'status' => in_array('unavailable', $statuses, true) ? 'unavailable' : (in_array('not_found', $statuses, true) ? 'not_found' : 'ok'),
            'latency_ms' => $latencies === [] ? null : array_sum($latencies),
        ];
    }

    private function id(mixed $value): ?string
    {
        return is_string($value) && $value !== '' ? $value : null;
    }
}
