<?php

namespace App\Console\Commands;

use App\Connectors\Exceptions\ConsoleException;
use App\Services\Domain\RecordService;
use App\Support\ApiException;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Str;
use Ramsey\Uuid\Uuid;

/**
 * Fills the three source APIs with demo data through the hub write flow (update 1 §10): reference checks
 * and audit run as for a real user. IDs are uuid v5 from natural keys (kontrak §6), so the APIs seeded
 * separately agree. A record whose ID already exists at its owner is skipped.
 */
#[Signature('hub:seed-demo {--dry-run : Tampilkan rencana tanpa menulis} {--only= : Daftar dipisah koma: people,productions,items}')]
#[Description('Isi data demo Personel, Produksi, dan Barang lewat alur tulis hub')]
class HubSeedDemo extends Command
{
    /** Shared namespace for deterministic seed IDs (kontrak §6). */
    public const NAMESPACE = '7a1f6c3e-5b8d-4f21-9a0c-3e2d1b4c5a60';

    private const ORDER = ['people', 'productions', 'items'];

    public function handle(RecordService $records): int
    {
        $only = $this->option('only') ? explode(',', (string) $this->option('only')) : self::ORDER;

        if (array_diff($only, self::ORDER) !== []) {
            $this->error('--only hanya boleh berisi: '.implode(',', self::ORDER));

            return self::FAILURE;
        }

        /** @var array{people: list<array<string, mixed>>, productions: list<array<string, mixed>>, items: list<array<string, mixed>>} $demo */
        $demo = json_decode((string) file_get_contents(database_path('seed-data/demo.json')), true, flags: JSON_THROW_ON_ERROR);
        $tally = ['dibuat' => 0, 'dilewati' => 0, 'ditolak' => 0];

        foreach (array_intersect(self::ORDER, $only) as $resource) {
            foreach ($demo[$resource] as $row) {
                $tally[$this->seed($records, $resource, $row)]++;
            }
        }

        $this->newLine();
        $this->table(['Dibuat', 'Dilewati', 'Ditolak'], [array_values($tally)]);

        return $tally['ditolak'] === 0 ? self::SUCCESS : self::FAILURE;
    }

    public static function personId(string $name): string
    {
        return self::uuid('person:'.Str::slug($name));
    }

    public static function productionId(string $area, string $type): string
    {
        return self::uuid('production:'.Str::slug($area).':'.Str::slug($type));
    }

    public static function itemId(string $name): string
    {
        return self::uuid('item:'.Str::slug($name));
    }

    /**
     * @param  'items'|'productions'|'people'  $resource
     * @param  array<string, mixed>  $row
     * @return 'dibuat'|'dilewati'|'ditolak'
     */
    private function seed(RecordService $records, string $resource, array $row): string
    {
        [$id, $label, $input] = $this->prepare($resource, $row);

        try {
            $records->raw($resource, $id);
            $this->line("  dilewati  {$resource} {$label}");

            return 'dilewati';
        } catch (ApiException $e) {
            if ($e->errorCode !== 'NOT_FOUND') {
                throw $e;
            }
        } catch (ConsoleException $e) {
            if (! $this->option('dry-run')) {
                $this->warn("  ditolak   {$resource} {$label}: {$e->getMessage()}");

                return 'ditolak';
            }
        }

        if ($this->option('dry-run')) {
            $this->line("  akan dibuat {$resource} {$label}");

            return 'dibuat';
        }

        try {
            $created = $records->create($resource, ['id' => $id, ...$input]);

            if (($row['status'] ?? 'aktif') === 'nonaktif') {
                $records->deactivate($resource, $id, (int) $created['version'], technical: true);
            }

            $this->info("  dibuat    {$resource} {$label}");

            return 'dibuat';
        } catch (ApiException|ConsoleException $e) {
            $this->warn("  ditolak   {$resource} {$label}: {$e->getMessage()}");

            return 'ditolak';
        }
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array{0: string, 1: string, 2: array<string, mixed>}
     */
    private function prepare(string $resource, array $row): array
    {
        $person = fn (?string $name) => $name === null ? null : self::personId($name);

        return match ($resource) {
            'people' => [self::personId($row['name']), $row['name'], ['name' => $row['name'], 'role' => $row['role']]],
            'productions' => [
                self::productionId($row['area'], $row['production_type']),
                "{$row['area']} · {$row['production_type']}",
                ['area' => $row['area'], 'production_type' => $row['production_type'], 'courier_id' => $person($row['courier'] ?? null)],
            ],
            default => [
                self::itemId($row['name']),
                $row['name'],
                [
                    'name' => $row['name'],
                    'kind' => $row['kind'],
                    'production_id' => isset($row['production']) ? self::productionId(...explode('|', $row['production'])) : null,
                    'responsible_id' => $person($row['responsible'] ?? null),
                    'quantity' => $row['quantity'],
                    'unit' => $row['unit'],
                ],
            ],
        };
    }

    private static function uuid(string $name): string
    {
        return Uuid::uuid5(self::NAMESPACE, $name)->toString();
    }
}
