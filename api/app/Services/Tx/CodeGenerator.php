<?php

namespace App\Services\Tx;

use Illuminate\Support\Facades\DB;

/**
 * Business codes (E-0001, DIV-01, SKU-BB-001, PO-2026-0001) from `code_counters`.
 * Numbers used by an aborted transaction stay used; gaps are allowed.
 */
class CodeGenerator
{
    public function employee(): string
    {
        return sprintf('E-%04d', $this->next('employee'));
    }

    public function division(): string
    {
        return sprintf('DIV-%02d', $this->next('division'));
    }

    /**
     * @param  'BB'|'BJ'  $kind
     */
    public function item(string $kind): string
    {
        return sprintf('SKU-%s-%03d', $kind, $this->next("item-{$kind}"));
    }

    public function order(): string
    {
        $year = now()->year;

        return sprintf('PO-%d-%04d', $year, $this->next("order-{$year}"));
    }

    /**
     * Atomically take the next number for a counter (creates it on first use).
     */
    public function next(string $key): int
    {
        return (int) DB::selectOne(
            'INSERT INTO code_counters (counter_key, last_value) VALUES (?, 1)
             ON CONFLICT (counter_key) DO UPDATE SET last_value = code_counters.last_value + 1
             RETURNING last_value',
            [$key],
        )->last_value;
    }

    /**
     * Make sure a counter is at least $value (used when seeding data with fixed codes).
     */
    public function bump(string $key, int $value): void
    {
        DB::statement(
            'INSERT INTO code_counters (counter_key, last_value) VALUES (?, ?)
             ON CONFLICT (counter_key) DO UPDATE SET last_value = GREATEST(code_counters.last_value, EXCLUDED.last_value)',
            [$key, $value],
        );
    }
}
