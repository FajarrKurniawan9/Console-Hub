<?php

namespace App\Services\Imports;

use App\Models\DataImport;
use App\Models\Role;
use App\Models\User;
use App\Services\Sources\SourceClient;
use App\Services\Sources\SourceRegistry;
use App\Support\ApiException;
use App\Support\Iso;
use Illuminate\Support\Str;

/**
 * Fetches full `?status=all` snapshots from the portal DB and source APIs, and performs
 * zero-ambiguity hybrid lookups (`UUID`, `Nama · Role`, `Area · Jenis Produksi`, or unique `Nama`).
 */
class ImportReferenceResolver
{
    public const MAX_SNAPSHOT_PAGES = 50; // 50 * 100 = 5,000 records max

    public const PAGE_LIMIT = 100;

    public function __construct(private SourceRegistry $sources) {}

    /**
     * Fetch the required snapshot dataset(s) for dry-run validation of the given entity type.
     *
     * @return array<string, mixed>
     */
    public function snapshotFor(string $type): array
    {
        return match ($type) {
            DataImport::TYPE_USERS => $this->usersSnapshot(),
            DataImport::TYPE_PERSONEL => [
                'people' => $this->fetchSourceSnapshot($this->sources->people()),
            ],
            DataImport::TYPE_PRODUKSI => [
                'people' => $this->fetchSourceSnapshot($this->sources->people()),
                'productions' => $this->fetchSourceSnapshot($this->sources->productions()),
            ],
            DataImport::TYPE_BARANG => [
                'people' => $this->fetchSourceSnapshot($this->sources->people()),
                'productions' => $this->fetchSourceSnapshot($this->sources->productions()),
                'items' => $this->fetchSourceSnapshot($this->sources->items()),
            ],
            default => throw ApiException::validation(['type' => ["Tipe entitas impor tidak valid: {$type}."]]),
        };
    }

    /**
     * Resolve a hybrid personel reference (`UUID`, `Nama · Role`, `Nama | Role`, or unique `Nama`).
     *
     * @param  array<string, array<string, mixed>>  $peopleById
     * @return array{ok: bool, id: string|null, label: string|null, error: string|null}
     */
    public function resolvePerson(string $rawInput, array $peopleById): array
    {
        $input = trim($rawInput);

        if ($input === '') {
            return ['ok' => true, 'id' => null, 'label' => null, 'error' => null];
        }

        if (Str::isUuid($input)) {
            $match = $this->findByUuidCaseInsensitive($input, $peopleById);

            if ($match === null) {
                return ['ok' => false, 'id' => null, 'label' => null, 'error' => 'ID personel tidak ditemukan.'];
            }

            if (($match['status'] ?? null) !== 'aktif') {
                return ['ok' => false, 'id' => null, 'label' => null, 'error' => 'Personel berstatus nonaktif dan tidak dapat digunakan.'];
            }

            return [
                'ok' => true,
                'id' => (string) $match['id'],
                'label' => $this->formatPersonLabel($match),
                'error' => null,
            ];
        }

        if (preg_match('/[·|]/u', $input) === 1) {
            $parts = preg_split('/\s*[·|]\s*/u', $input, 2);
            $namePart = trim((string) ($parts[0] ?? ''));
            $rolePart = trim((string) ($parts[1] ?? ''));

            if ($namePart === '' || $rolePart === '') {
                return ['ok' => false, 'id' => null, 'label' => null, 'error' => "Format personel harus 'Nama · Role' atau UUID."];
            }

            $targetName = mb_strtolower($namePart);
            $targetRole = mb_strtolower($rolePart);
            $activeMatches = [];
            $inactiveFound = false;

            foreach ($peopleById as $record) {
                $same = mb_strtolower(trim((string) ($record['name'] ?? ''))) === $targetName
                    && mb_strtolower(trim((string) ($record['role'] ?? ''))) === $targetRole;

                if (! $same) {
                    continue;
                }

                if (($record['status'] ?? null) === 'aktif') {
                    $activeMatches[] = $record;
                } else {
                    $inactiveFound = true;
                }
            }

            if (count($activeMatches) === 1) {
                $match = $activeMatches[0];

                return [
                    'ok' => true,
                    'id' => (string) $match['id'],
                    'label' => $this->formatPersonLabel($match),
                    'error' => null,
                ];
            }

            if (count($activeMatches) > 1) {
                return [
                    'ok' => false,
                    'id' => null,
                    'label' => null,
                    'error' => 'Nama dan role personel ambigu (ditemukan '.count($activeMatches).' personel aktif). Gunakan UUID.',
                ];
            }

            return [
                'ok' => false,
                'id' => null,
                'label' => null,
                'error' => $inactiveFound
                    ? "Personel '{$input}' berstatus nonaktif dan tidak dapat digunakan."
                    : "Personel '{$input}' tidak ditemukan.",
            ];
        }

        $targetName = mb_strtolower($input);
        $activeMatches = [];
        $inactiveFound = false;

        foreach ($peopleById as $record) {
            if (mb_strtolower(trim((string) ($record['name'] ?? ''))) !== $targetName) {
                continue;
            }

            if (($record['status'] ?? null) === 'aktif') {
                $activeMatches[] = $record;
            } else {
                $inactiveFound = true;
            }
        }

        if (count($activeMatches) === 1) {
            $match = $activeMatches[0];

            return [
                'ok' => true,
                'id' => (string) $match['id'],
                'label' => $this->formatPersonLabel($match),
                'error' => null,
            ];
        }

        if (count($activeMatches) > 1) {
            return [
                'ok' => false,
                'id' => null,
                'label' => null,
                'error' => 'Nama personel ambigu (ditemukan '.count($activeMatches)." personel aktif). Gunakan UUID atau format 'Nama · Role'.",
            ];
        }

        return [
            'ok' => false,
            'id' => null,
            'label' => null,
            'error' => $inactiveFound
                ? "Personel bernama '{$input}' berstatus nonaktif dan tidak dapat digunakan."
                : "Personel '{$input}' tidak ditemukan.",
        ];
    }

    /**
     * Resolve a hybrid production reference (`UUID`, `Area · Jenis Produksi`, or `Area | Jenis Produksi`).
     *
     * @param  array<string, array<string, mixed>>  $productionsById
     * @return array{ok: bool, id: string|null, label: string|null, error: string|null}
     */
    public function resolveProduction(string $rawInput, array $productionsById): array
    {
        $input = trim($rawInput);

        if ($input === '') {
            return ['ok' => true, 'id' => null, 'label' => null, 'error' => null];
        }

        if (Str::isUuid($input)) {
            $match = $this->findByUuidCaseInsensitive($input, $productionsById);

            if ($match === null) {
                return ['ok' => false, 'id' => null, 'label' => null, 'error' => 'ID produksi tidak ditemukan.'];
            }

            if (($match['status'] ?? null) !== 'aktif') {
                return ['ok' => false, 'id' => null, 'label' => null, 'error' => 'Produksi berstatus nonaktif dan tidak dapat digunakan.'];
            }

            return [
                'ok' => true,
                'id' => (string) $match['id'],
                'label' => $this->formatProductionLabel($match),
                'error' => null,
            ];
        }

        if (preg_match('/[·|]/u', $input) !== 1) {
            return [
                'ok' => false,
                'id' => null,
                'label' => null,
                'error' => "Gunakan UUID produksi atau format 'Area · Jenis Produksi'.",
            ];
        }

        $parts = preg_split('/\s*[·|]\s*/u', $input, 2);
        $areaPart = trim((string) ($parts[0] ?? ''));
        $typePart = trim((string) ($parts[1] ?? ''));

        if ($areaPart === '' || $typePart === '') {
            return [
                'ok' => false,
                'id' => null,
                'label' => null,
                'error' => "Format produksi harus 'Area · Jenis Produksi' atau UUID.",
            ];
        }

        $targetArea = mb_strtolower($areaPart);
        $targetType = mb_strtolower($typePart);
        $activeMatches = [];
        $inactiveFound = false;

        foreach ($productionsById as $record) {
            $same = mb_strtolower(trim((string) ($record['area'] ?? ''))) === $targetArea
                && mb_strtolower(trim((string) ($record['production_type'] ?? ''))) === $targetType;

            if (! $same) {
                continue;
            }

            if (($record['status'] ?? null) === 'aktif') {
                $activeMatches[] = $record;
            } else {
                $inactiveFound = true;
            }
        }

        if (count($activeMatches) === 1) {
            $match = $activeMatches[0];

            return [
                'ok' => true,
                'id' => (string) $match['id'],
                'label' => $this->formatProductionLabel($match),
                'error' => null,
            ];
        }

        if (count($activeMatches) > 1) {
            return [
                'ok' => false,
                'id' => null,
                'label' => null,
                'error' => 'Kombinasi area dan jenis produksi ambigu. Gunakan UUID.',
            ];
        }

        return [
            'ok' => false,
            'id' => null,
            'label' => null,
            'error' => $inactiveFound
                ? "Produksi '{$input}' berstatus nonaktif dan tidak dapat digunakan."
                : "Produksi '{$input}' tidak ditemukan.",
        ];
    }

    /**
     * @param  array<string, mixed>  $record
     */
    public function formatPersonLabel(array $record): string
    {
        return trim(((string) ($record['name'] ?? '')).' · '.((string) ($record['role'] ?? '')), ' ·');
    }

    /**
     * @param  array<string, mixed>  $record
     */
    public function formatProductionLabel(array $record): string
    {
        return trim(((string) ($record['area'] ?? '')).' · '.((string) ($record['production_type'] ?? '')), ' ·');
    }

    /**
     * @param  array<string, array<string, mixed>>  $recordsById
     * @return array<string, mixed>|null
     */
    public function findByUuidCaseInsensitive(string $uuid, array $recordsById): ?array
    {
        $needle = strtolower($uuid);

        if (isset($recordsById[$needle])) {
            return $recordsById[$needle];
        }

        foreach ($recordsById as $id => $record) {
            if (strtolower((string) $id) === $needle) {
                return $record;
            }
        }

        return null;
    }

    /**
     * @return array{users_by_email: array<string, array<string, mixed>>, roles_by_code: array<string, array{id: int, code: string, name: string, can_manage_rbac: bool}>}
     */
    private function usersSnapshot(): array
    {
        $rolesByCode = [];

        foreach (Role::query()->with('permissions:id,code')->get() as $role) {
            /** @var Role $role */
            $rolesByCode[mb_strtolower($role->code)] = [
                'id' => $role->id,
                'code' => $role->code,
                'name' => $role->name,
                'can_manage_rbac' => $role->permissions->contains('code', 'admin.rbac.manage'),
            ];
        }

        $usersByEmail = [];

        foreach (User::query()->with('role:id,code,name')->get() as $user) {
            /** @var User $user */
            $usersByEmail[mb_strtolower($user->email)] = [
                'id' => $user->id,
                'name' => $user->name,
                'email' => mb_strtolower($user->email),
                'role_id' => $user->role_id,
                'role_code' => $user->role->code,
                'is_active' => (bool) $user->is_active,
                'updated_at' => Iso::utc($user->updated_at),
            ];
        }

        return [
            'users_by_email' => $usersByEmail,
            'roles_by_code' => $rolesByCode,
        ];
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function fetchSourceSnapshot(SourceClient $client): array
    {
        $records = [];
        $cursor = null;
        $seenCursors = [];

        for ($pageNum = 0; $pageNum < self::MAX_SNAPSHOT_PAGES; $pageNum++) {
            $query = ['status' => 'all', 'limit' => self::PAGE_LIMIT];

            if ($cursor !== null) {
                $query['cursor'] = $cursor;
            }

            $page = $client->list($query)->orFail();

            foreach ($page['data'] ?? [] as $row) {
                if (is_array($row) && isset($row['id'])) {
                    $id = strtolower((string) $row['id']);
                    $records[$id] = $row;
                }
            }

            $next = is_string($page['next_cursor'] ?? null) && $page['next_cursor'] !== ''
                ? $page['next_cursor']
                : null;

            if ($next === null) {
                return $records;
            }

            if (isset($seenCursors[$next])) {
                break;
            }

            $seenCursors[$next] = true;
            $cursor = $next;
        }

        throw ApiException::validation([
            'file' => ["Jumlah data di sumber {$client->source} melebihi batas snapshot impor (5.000 baris)."],
        ], 'Data di sumber melebihi batas snapshot impor (maks 5.000 baris).');
    }
}
