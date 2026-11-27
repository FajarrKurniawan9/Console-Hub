<?php

namespace App\Services\Imports;

use App\Models\DataImport;
use App\Models\User;
use Illuminate\Support\Str;

/**
 * Dry-run validator and diff builder enforcing zero-ambiguity, anti-zombie, and per-entity rules.
 */
class ImportValidator
{
    public function __construct(
        private ImportReferenceResolver $resolver,
    ) {}

    /**
     * Validate parsed rows against fresh snapshots and produce plan summary + per-row plan entries.
     *
     * @param  list<array{row_number: int, values: array<string, string>}>  $sourceRows
     * @return array{
     *     total_rows: int,
     *     valid_rows: int,
     *     create_count: int,
     *     update_count: int,
     *     skip_count: int,
     *     invalid_count: int,
     *     plan_rows: list<array<string, mixed>>
     * }
     */
    public function buildPlan(string $type, string $mode, array $sourceRows, User $actor): array
    {
        $snapshot = $this->resolver->snapshotFor($type);

        $planRows = match ($type) {
            DataImport::TYPE_USERS => $this->planUsers($mode, $sourceRows, $snapshot, $actor),
            DataImport::TYPE_PERSONEL => $this->planPersonel($mode, $sourceRows, $snapshot),
            DataImport::TYPE_PRODUKSI => $this->planProduksi($mode, $sourceRows, $snapshot),
            DataImport::TYPE_BARANG => $this->planBarang($mode, $sourceRows, $snapshot),
            default => [],
        };

        $createCount = 0;
        $updateCount = 0;
        $skipCount = 0;
        $invalidCount = 0;

        foreach ($planRows as $row) {
            match ($row['action']) {
                'create' => $createCount++,
                'update' => $updateCount++,
                'skip' => $skipCount++,
                default => $invalidCount++,
            };
        }

        return [
            'total_rows' => count($planRows),
            'valid_rows' => $createCount + $updateCount,
            'create_count' => $createCount,
            'update_count' => $updateCount,
            'skip_count' => $skipCount,
            'invalid_count' => $invalidCount,
            'plan_rows' => $planRows,
        ];
    }

    /**
     * @param  list<array{row_number: int, values: array<string, string>}>  $sourceRows
     * @param  array<string, mixed>  $snapshot
     * @return list<array<string, mixed>>
     */
    private function planUsers(string $mode, array $sourceRows, array $snapshot, User $actor): array
    {
        /** @var array<string, array<string, mixed>> $usersByEmail */
        $usersByEmail = $snapshot['users_by_email'];
        /** @var array<string, array{id: int, code: string, name: string, can_manage_rbac: bool}> $rolesByCode */
        $rolesByCode = $snapshot['roles_by_code'];

        $emailCounts = [];
        foreach ($sourceRows as $row) {
            $email = mb_strtolower(trim($row['values']['email'] ?? ''));
            if ($email !== '') {
                $emailCounts[$email] = ($emailCounts[$email] ?? 0) + 1;
            }
        }

        $actorEmail = mb_strtolower($actor->email);
        $plan = [];

        foreach ($sourceRows as $row) {
            $values = $row['values'];
            $errors = [];

            $name = trim($values['name'] ?? '');
            $email = mb_strtolower(trim($values['email'] ?? ''));
            $roleCode = mb_strtolower(trim($values['role_code'] ?? ''));

            $this->validateStringField('name', $name, 3, 100, true, $errors);

            if ($email === '') {
                $errors['email'] = 'Email wajib diisi.';
            } elseif (mb_strlen($email) > 150 || filter_var($email, FILTER_VALIDATE_EMAIL) === false || $this->hasControlChars($email)) {
                $errors['email'] = 'Format email tidak valid (maks 150 karakter).';
            } elseif (($emailCounts[$email] ?? 0) > 1) {
                $errors['email'] = 'Email duplikat di dalam file unggahan.';
            }

            if ($roleCode === '') {
                $errors['role_code'] = 'Role code wajib diisi.';
            } elseif (! isset($rolesByCode[$roleCode])) {
                $errors['role_code'] = "Role code '{$roleCode}' tidak ditemukan di sistem.";
            }

            if ($errors !== []) {
                $plan[] = $this->invalidRow($row['row_number'], $values, $errors);

                continue;
            }

            $role = $rolesByCode[$roleCode];
            $existing = $usersByEmail[$email] ?? null;

            if ($existing === null) {
                $plan[] = $this->planRow(
                    $row['row_number'],
                    'create',
                    $values,
                    payload: [
                        'name' => $name,
                        'email' => $email,
                        'role_id' => $role['id'],
                        'role_code' => $role['code'],
                    ],
                );

                continue;
            }

            if ($mode === DataImport::MODE_CREATE_ONLY) {
                $plan[] = $this->planRow(
                    $row['row_number'],
                    'skip',
                    $values,
                    targetId: (string) $existing['id'],
                    reason: 'Email sudah terdaftar di portal.',
                );

                continue;
            }

            if (! $existing['is_active']) {
                $plan[] = $this->planRow(
                    $row['row_number'],
                    'skip',
                    $values,
                    targetId: (string) $existing['id'],
                    reason: 'Akun sudah dinonaktifkan sebelumnya; dilewati agar tidak aktif kembali tanpa sengaja.',
                );

                continue;
            }

            if ($email === $actorEmail && ! $role['can_manage_rbac']) {
                $errors['role_code'] = 'Anda tidak dapat mencabut akses RBAC dari akun Anda sendiri.';
                $plan[] = $this->invalidRow($row['row_number'], $values, $errors);

                continue;
            }

            $diff = [];
            $payload = [];

            if ($name !== (string) $existing['name']) {
                $diff['name'] = ['old' => $existing['name'], 'new' => $name];
                $payload['name'] = $name;
            }

            if ($role['code'] !== (string) $existing['role_code']) {
                $diff['role_code'] = ['old' => $existing['role_code'], 'new' => $role['code']];
                $payload['role_id'] = $role['id'];
                $payload['role_code'] = $role['code'];
            }

            if ($diff === []) {
                $plan[] = $this->planRow(
                    $row['row_number'],
                    'skip',
                    $values,
                    targetId: (string) $existing['id'],
                    reason: 'Tidak ada perubahan.',
                );

                continue;
            }

            $plan[] = $this->planRow(
                $row['row_number'],
                'update',
                $values,
                targetId: (string) $existing['id'],
                expectedUpdatedAt: (string) $existing['updated_at'],
                payload: $payload,
                diff: $diff,
            );
        }

        return $plan;
    }

    /**
     * @param  list<array{row_number: int, values: array<string, string>}>  $sourceRows
     * @param  array<string, mixed>  $snapshot
     * @return list<array<string, mixed>>
     */
    private function planPersonel(string $mode, array $sourceRows, array $snapshot): array
    {
        /** @var array<string, array<string, mixed>> $peopleById */
        $peopleById = $snapshot['people'];

        $idCounts = [];
        $naturalCounts = [];
        $naturalIndex = $this->indexByNaturalKey($peopleById, ['name', 'role']);

        foreach ($sourceRows as $row) {
            $id = strtolower(trim($row['values']['id'] ?? ''));
            $name = trim($row['values']['name'] ?? '');
            $role = trim($row['values']['role'] ?? '');

            if ($id !== '') {
                $idCounts[$id] = ($idCounts[$id] ?? 0) + 1;
            } elseif ($name !== '' && $role !== '') {
                $nk = $this->naturalKey([$name, $role]);
                $naturalCounts[$nk] = ($naturalCounts[$nk] ?? 0) + 1;
            }
        }

        $plan = [];

        foreach ($sourceRows as $row) {
            $values = $row['values'];
            $errors = [];

            $id = trim($values['id'] ?? '');
            $name = trim($values['name'] ?? '');
            $role = trim($values['role'] ?? '');

            if ($id !== '') {
                if ($mode === DataImport::MODE_CREATE_ONLY) {
                    $errors['id'] = 'Kosongkan kolom id pada mode Tambah Baru Saja, atau gunakan mode Upsert.';
                } elseif (! Str::isUuid($id)) {
                    $errors['id'] = 'Format UUID kolom id tidak valid.';
                } elseif (($idCounts[strtolower($id)] ?? 0) > 1) {
                    $errors['id'] = 'ID personel duplikat di dalam file unggahan.';
                }
            }

            $this->validateStringField('name', $name, 2, 120, true, $errors);
            $this->validateStringField('role', $role, 2, 60, true, $errors);

            $nk = $this->naturalKey([$name, $role]);
            if ($id === '' && $name !== '' && $role !== '' && ($naturalCounts[$nk] ?? 0) > 1) {
                $errors['name'] = 'Duplikat kombinasi nama dan role personel di dalam file unggahan.';
            }

            if ($errors !== []) {
                $plan[] = $this->invalidRow($row['row_number'], $values, $errors);

                continue;
            }

            if ($id !== '') {
                $existing = $this->resolver->findByUuidCaseInsensitive($id, $peopleById);

                if ($existing === null) {
                    $plan[] = $this->invalidRow($row['row_number'], $values, ['id' => 'ID personel tidak ditemukan.']);

                    continue;
                }

                if (($existing['status'] ?? null) !== 'aktif') {
                    $plan[] = $this->planRow(
                        $row['row_number'],
                        'skip',
                        $values,
                        targetId: (string) $existing['id'],
                        reason: 'Data sudah dinonaktifkan sebelumnya; dilewati agar tidak aktif kembali tanpa sengaja.',
                    );

                    continue;
                }

                $diff = [];
                $payload = [];

                if ($name !== (string) ($existing['name'] ?? '')) {
                    $diff['name'] = ['old' => $existing['name'] ?? '', 'new' => $name];
                    $payload['name'] = $name;
                }

                if ($role !== (string) ($existing['role'] ?? '')) {
                    $diff['role'] = ['old' => $existing['role'] ?? '', 'new' => $role];
                    $payload['role'] = $role;
                }

                if ($diff === []) {
                    $plan[] = $this->planRow(
                        $row['row_number'],
                        'skip',
                        $values,
                        targetId: (string) $existing['id'],
                        reason: 'Tidak ada perubahan.',
                    );

                    continue;
                }

                $plan[] = $this->planRow(
                    $row['row_number'],
                    'update',
                    $values,
                    targetId: (string) $existing['id'],
                    expectedVersion: (int) ($existing['version'] ?? 1),
                    payload: $payload,
                    diff: $diff,
                );

                continue;
            }

            // No ID provided
            $match = $naturalIndex[$nk] ?? null;

            if ($match !== null) {
                $activeMatch = $match['aktif'][0] ?? null;
                $inactiveMatch = $match['nonaktif'][0] ?? null;

                if ($activeMatch !== null) {
                    $reason = $mode === DataImport::MODE_CREATE_ONLY
                        ? 'Kombinasi nama dan role sudah terdaftar di HR.'
                        : 'Potensi duplikat dengan personel aktif (ID: '.$activeMatch['id'].'). Isi kolom id jika ingin memperbarui.';

                    $plan[] = $this->planRow(
                        $row['row_number'],
                        'skip',
                        $values,
                        targetId: (string) $activeMatch['id'],
                        reason: $reason,
                    );

                    continue;
                }

                if ($inactiveMatch !== null) {
                    $plan[] = $this->planRow(
                        $row['row_number'],
                        'skip',
                        $values,
                        targetId: (string) $inactiveMatch['id'],
                        reason: 'Data serupa pernah dinonaktifkan; dilewati untuk mencegah duplikat/zombie.',
                    );

                    continue;
                }
            }

            $plan[] = $this->planRow(
                $row['row_number'],
                'create',
                $values,
                payload: [
                    'name' => $name,
                    'role' => $role,
                ],
            );
        }

        return $plan;
    }

    /**
     * @param  list<array{row_number: int, values: array<string, string>}>  $sourceRows
     * @param  array<string, mixed>  $snapshot
     * @return list<array<string, mixed>>
     */
    private function planProduksi(string $mode, array $sourceRows, array $snapshot): array
    {
        /** @var array<string, array<string, mixed>> $peopleById */
        $peopleById = $snapshot['people'];
        /** @var array<string, array<string, mixed>> $productionsById */
        $productionsById = $snapshot['productions'];

        $idCounts = [];
        $naturalCounts = [];
        $naturalIndex = $this->indexByNaturalKey($productionsById, ['area', 'production_type']);

        foreach ($sourceRows as $row) {
            $id = strtolower(trim($row['values']['id'] ?? ''));
            $area = trim($row['values']['area'] ?? '');
            $type = trim($row['values']['production_type'] ?? '');

            if ($id !== '') {
                $idCounts[$id] = ($idCounts[$id] ?? 0) + 1;
            }

            if ($area !== '' && $type !== '') {
                $nk = $this->naturalKey([$area, $type]);
                $naturalCounts[$nk] = ($naturalCounts[$nk] ?? 0) + 1;
            }
        }

        $plan = [];
        $seenTargetIds = [];

        foreach ($sourceRows as $row) {
            $values = $row['values'];
            $errors = [];

            $id = trim($values['id'] ?? '');
            $area = trim($values['area'] ?? '');
            $productionType = trim($values['production_type'] ?? '');
            $courierRaw = trim($values['courier'] ?? '');

            if ($id !== '') {
                if ($mode === DataImport::MODE_CREATE_ONLY) {
                    $errors['id'] = 'Kosongkan kolom id pada mode Tambah Baru Saja, atau gunakan mode Upsert.';
                } elseif (! Str::isUuid($id)) {
                    $errors['id'] = 'Format UUID kolom id tidak valid.';
                } elseif (($idCounts[strtolower($id)] ?? 0) > 1) {
                    $errors['id'] = 'ID produksi duplikat di dalam file unggahan.';
                }
            }

            $this->validateStringField('area', $area, 2, 80, true, $errors);
            $this->validateStringField('production_type', $productionType, 2, 80, true, $errors);

            $nk = $this->naturalKey([$area, $productionType]);
            if ($area !== '' && $productionType !== '' && ($naturalCounts[$nk] ?? 0) > 1) {
                $errors['area'] = 'Duplikat kombinasi area dan jenis produksi di dalam file unggahan.';
            }

            $courierResolved = ['ok' => true, 'id' => null, 'label' => null, 'error' => null];
            if ($courierRaw !== '') {
                if ($this->hasControlChars($courierRaw)) {
                    $errors['courier'] = 'Kolom courier mengandung karakter kontrol yang tidak valid.';
                } else {
                    $courierResolved = $this->resolver->resolvePerson($courierRaw, $peopleById);
                    if (! $courierResolved['ok']) {
                        $errors['courier'] = (string) $courierResolved['error'];
                    }
                }
            }

            if ($errors !== []) {
                $plan[] = $this->invalidRow($row['row_number'], $values, $errors);

                continue;
            }

            if ($id !== '') {
                $existing = $this->resolver->findByUuidCaseInsensitive($id, $productionsById);

                if ($existing === null) {
                    $plan[] = $this->invalidRow($row['row_number'], $values, ['id' => 'ID produksi tidak ditemukan.']);

                    continue;
                }

                $targetId = (string) $existing['id'];
                if (isset($seenTargetIds[$targetId])) {
                    $plan[] = $this->invalidRow($row['row_number'], $values, ['id' => 'Target produksi yang sama sudah dituju pada baris sebelumnya.']);

                    continue;
                }
                $seenTargetIds[$targetId] = true;

                if (($existing['status'] ?? null) !== 'aktif') {
                    $plan[] = $this->planRow(
                        $row['row_number'],
                        'skip',
                        $values,
                        targetId: $targetId,
                        reason: 'Data sudah dinonaktifkan sebelumnya; dilewati agar tidak aktif kembali tanpa sengaja.',
                    );

                    continue;
                }

                // Check collision against any other active production with the target (area, production_type).
                $collisions = $naturalIndex[$nk]['aktif'] ?? [];
                foreach ($collisions as $other) {
                    if ((string) $other['id'] !== $targetId) {
                        $plan[] = $this->invalidRow($row['row_number'], $values, [
                            'area' => 'Kombinasi area dan jenis produksi bentrok dengan produksi aktif lain (ID: '.$other['id'].').',
                        ]);

                        continue 2;
                    }
                }

                $diff = [];
                $payload = [];

                if ($area !== (string) ($existing['area'] ?? '')) {
                    $diff['area'] = ['old' => $existing['area'] ?? '', 'new' => $area];
                    $payload['area'] = $area;
                }

                if ($productionType !== (string) ($existing['production_type'] ?? '')) {
                    $diff['production_type'] = ['old' => $existing['production_type'] ?? '', 'new' => $productionType];
                    $payload['production_type'] = $productionType;
                }

                // Empty optional courier keeps the existing value unchanged on upsert.
                if ($courierRaw !== '') {
                    $oldCourierId = $existing['courier_id'] ?? null;
                    if ($courierResolved['id'] !== $oldCourierId) {
                        $diff['courier'] = [
                            'old' => $this->displayPerson($oldCourierId, $peopleById),
                            'new' => $courierResolved['label'],
                        ];
                        $payload['courier_id'] = $courierResolved['id'];
                    }
                }

                if ($diff === []) {
                    $plan[] = $this->planRow(
                        $row['row_number'],
                        'skip',
                        $values,
                        targetId: $targetId,
                        reason: 'Tidak ada perubahan.',
                    );

                    continue;
                }

                $plan[] = $this->planRow(
                    $row['row_number'],
                    'update',
                    $values,
                    targetId: $targetId,
                    expectedVersion: (int) ($existing['version'] ?? 1),
                    payload: $payload,
                    diff: $diff,
                );

                continue;
            }

            // No ID provided
            $match = $naturalIndex[$nk] ?? null;
            $activeMatch = $match['aktif'][0] ?? null;
            $inactiveMatch = $match['nonaktif'][0] ?? null;

            if ($mode === DataImport::MODE_CREATE_ONLY) {
                if ($activeMatch !== null || $inactiveMatch !== null) {
                    $targetId = (string) ($activeMatch['id'] ?? $inactiveMatch['id']);
                    $reason = $activeMatch !== null
                        ? 'Kombinasi area dan jenis produksi aktif sudah terdaftar.'
                        : 'Data serupa pernah dinonaktifkan; dilewati untuk mencegah duplikat/zombie.';

                    $plan[] = $this->planRow($row['row_number'], 'skip', $values, targetId: $targetId, reason: $reason);

                    continue;
                }
            } else {
                if ($activeMatch !== null) {
                    $targetId = (string) $activeMatch['id'];

                    if (isset($seenTargetIds[$targetId])) {
                        $plan[] = $this->invalidRow($row['row_number'], $values, ['area' => 'Target produksi yang sama sudah dituju pada baris sebelumnya.']);

                        continue;
                    }
                    $seenTargetIds[$targetId] = true;

                    // Empty optional courier keeps existing value unchanged.
                    if ($courierRaw === '' || $courierResolved['id'] === ($activeMatch['courier_id'] ?? null)) {
                        $plan[] = $this->planRow(
                            $row['row_number'],
                            'skip',
                            $values,
                            targetId: $targetId,
                            reason: 'Tidak ada perubahan.',
                        );

                        continue;
                    }

                    $oldCourierId = $activeMatch['courier_id'] ?? null;
                    $plan[] = $this->planRow(
                        $row['row_number'],
                        'update',
                        $values,
                        targetId: $targetId,
                        expectedVersion: (int) ($activeMatch['version'] ?? 1),
                        payload: ['courier_id' => $courierResolved['id']],
                        diff: [
                            'courier' => [
                                'old' => $this->displayPerson($oldCourierId, $peopleById),
                                'new' => $courierResolved['label'],
                            ],
                        ],
                    );

                    continue;
                }

                if ($inactiveMatch !== null) {
                    $plan[] = $this->planRow(
                        $row['row_number'],
                        'skip',
                        $values,
                        targetId: (string) $inactiveMatch['id'],
                        reason: 'Data serupa pernah dinonaktifkan; dilewati untuk mencegah duplikat/zombie.',
                    );

                    continue;
                }
            }

            $plan[] = $this->planRow(
                $row['row_number'],
                'create',
                $values,
                payload: [
                    'area' => $area,
                    'production_type' => $productionType,
                    'courier_id' => $courierResolved['id'],
                ],
            );
        }

        return $plan;
    }

    /**
     * @param  list<array{row_number: int, values: array<string, string>}>  $sourceRows
     * @param  array<string, mixed>  $snapshot
     * @return list<array<string, mixed>>
     */
    private function planBarang(string $mode, array $sourceRows, array $snapshot): array
    {
        /** @var array<string, array<string, mixed>> $peopleById */
        $peopleById = $snapshot['people'];
        /** @var array<string, array<string, mixed>> $productionsById */
        $productionsById = $snapshot['productions'];
        /** @var array<string, array<string, mixed>> $itemsById */
        $itemsById = $snapshot['items'];

        $idCounts = [];
        $naturalCounts = [];
        $naturalIndex = $this->indexByNaturalKey($itemsById, ['name', 'kind']);

        foreach ($sourceRows as $row) {
            $id = strtolower(trim($row['values']['id'] ?? ''));
            $name = trim($row['values']['name'] ?? '');
            $kind = trim($row['values']['kind'] ?? '');

            if ($id !== '') {
                $idCounts[$id] = ($idCounts[$id] ?? 0) + 1;
            } elseif ($name !== '' && $kind !== '') {
                $nk = $this->naturalKey([$name, $kind]);
                $naturalCounts[$nk] = ($naturalCounts[$nk] ?? 0) + 1;
            }
        }

        $plan = [];

        foreach ($sourceRows as $row) {
            $values = $row['values'];
            $errors = [];

            $id = trim($values['id'] ?? '');
            $name = trim($values['name'] ?? '');
            $kind = trim($values['kind'] ?? '');
            $productionRaw = trim($values['production'] ?? '');
            $responsibleRaw = trim($values['responsible'] ?? '');
            $quantityRaw = trim($values['quantity'] ?? '');
            $unitRaw = trim($values['unit'] ?? '');

            if ($id !== '') {
                if ($mode === DataImport::MODE_CREATE_ONLY) {
                    $errors['id'] = 'Kosongkan kolom id pada mode Tambah Baru Saja, atau gunakan mode Upsert.';
                } elseif (! Str::isUuid($id)) {
                    $errors['id'] = 'Format UUID kolom id tidak valid.';
                } elseif (($idCounts[strtolower($id)] ?? 0) > 1) {
                    $errors['id'] = 'ID barang duplikat di dalam file unggahan.';
                }
            }

            $this->validateStringField('name', $name, 2, 120, true, $errors);
            $this->validateStringField('kind', $kind, 2, 60, true, $errors);

            $nk = $this->naturalKey([$name, $kind]);
            if ($id === '' && $name !== '' && $kind !== '' && ($naturalCounts[$nk] ?? 0) > 1) {
                $errors['name'] = 'Duplikat kombinasi nama dan jenis barang di dalam file unggahan.';
            }

            $productionResolved = ['ok' => true, 'id' => null, 'label' => null, 'error' => null];
            if ($productionRaw !== '') {
                if ($this->hasControlChars($productionRaw)) {
                    $errors['production'] = 'Kolom production mengandung karakter kontrol yang tidak valid.';
                } else {
                    $productionResolved = $this->resolver->resolveProduction($productionRaw, $productionsById);
                    if (! $productionResolved['ok']) {
                        $errors['production'] = (string) $productionResolved['error'];
                    }
                }
            }

            $responsibleResolved = ['ok' => true, 'id' => null, 'label' => null, 'error' => null];
            if ($responsibleRaw !== '') {
                if ($this->hasControlChars($responsibleRaw)) {
                    $errors['responsible'] = 'Kolom responsible mengandung karakter kontrol yang tidak valid.';
                } else {
                    $responsibleResolved = $this->resolver->resolvePerson($responsibleRaw, $peopleById);
                    if (! $responsibleResolved['ok']) {
                        $errors['responsible'] = (string) $responsibleResolved['error'];
                    }
                }
            }

            $quantityValue = null;
            if ($quantityRaw !== '') {
                if (preg_match('/^\d+$/', $quantityRaw) !== 1) {
                    $errors['quantity'] = 'Kolom quantity harus berupa bilangan bulat >= 0 (tanpa desimal atau negatif).';
                } else {
                    $quantityValue = (int) $quantityRaw;
                }
            }

            if ($unitRaw !== '') {
                $this->validateStringField('unit', $unitRaw, 1, 20, false, $errors);
            }

            if ($errors !== []) {
                $plan[] = $this->invalidRow($row['row_number'], $values, $errors);

                continue;
            }

            if ($id !== '') {
                $existing = $this->resolver->findByUuidCaseInsensitive($id, $itemsById);

                if ($existing === null) {
                    $plan[] = $this->invalidRow($row['row_number'], $values, ['id' => 'ID barang tidak ditemukan.']);

                    continue;
                }

                if (($existing['status'] ?? null) !== 'aktif') {
                    $plan[] = $this->planRow(
                        $row['row_number'],
                        'skip',
                        $values,
                        targetId: (string) $existing['id'],
                        reason: 'Data sudah dinonaktifkan sebelumnya; dilewati agar tidak aktif kembali tanpa sengaja.',
                    );

                    continue;
                }

                $diff = [];
                $payload = [];

                if ($name !== (string) ($existing['name'] ?? '')) {
                    $diff['name'] = ['old' => $existing['name'] ?? '', 'new' => $name];
                    $payload['name'] = $name;
                }

                if ($kind !== (string) ($existing['kind'] ?? '')) {
                    $diff['kind'] = ['old' => $existing['kind'] ?? '', 'new' => $kind];
                    $payload['kind'] = $kind;
                }

                // Empty optional cells keep existing values unchanged on upsert.
                if ($productionRaw !== '') {
                    $oldProdId = $existing['production_id'] ?? null;
                    if ($productionResolved['id'] !== $oldProdId) {
                        $diff['production'] = [
                            'old' => $this->displayProduction($oldProdId, $productionsById),
                            'new' => $productionResolved['label'],
                        ];
                        $payload['production_id'] = $productionResolved['id'];
                    }
                }

                if ($responsibleRaw !== '') {
                    $oldRespId = $existing['responsible_id'] ?? null;
                    if ($responsibleResolved['id'] !== $oldRespId) {
                        $diff['responsible'] = [
                            'old' => $this->displayPerson($oldRespId, $peopleById),
                            'new' => $responsibleResolved['label'],
                        ];
                        $payload['responsible_id'] = $responsibleResolved['id'];
                    }
                }

                if ($quantityValue !== null) {
                    $oldQty = (int) ($existing['quantity'] ?? 0);
                    if ($quantityValue !== $oldQty) {
                        $diff['quantity'] = ['old' => $oldQty, 'new' => $quantityValue];
                        $payload['quantity'] = $quantityValue;
                    }
                }

                if ($unitRaw !== '') {
                    $oldUnit = (string) ($existing['unit'] ?? 'pcs');
                    if ($unitRaw !== $oldUnit) {
                        $diff['unit'] = ['old' => $oldUnit, 'new' => $unitRaw];
                        $payload['unit'] = $unitRaw;
                    }
                }

                if ($diff === []) {
                    $plan[] = $this->planRow(
                        $row['row_number'],
                        'skip',
                        $values,
                        targetId: (string) $existing['id'],
                        reason: 'Tidak ada perubahan.',
                    );

                    continue;
                }

                $plan[] = $this->planRow(
                    $row['row_number'],
                    'update',
                    $values,
                    targetId: (string) $existing['id'],
                    expectedVersion: (int) ($existing['version'] ?? 1),
                    payload: $payload,
                    diff: $diff,
                );

                continue;
            }

            // No ID provided
            $match = $naturalIndex[$nk] ?? null;

            if ($match !== null) {
                $activeMatch = $match['aktif'][0] ?? null;
                $inactiveMatch = $match['nonaktif'][0] ?? null;

                if ($activeMatch !== null) {
                    $reason = $mode === DataImport::MODE_CREATE_ONLY
                        ? 'Kombinasi nama dan jenis barang sudah terdaftar di Gudang.'
                        : 'Potensi duplikat dengan barang aktif (ID: '.$activeMatch['id'].'). Isi kolom id jika ingin memperbarui.';

                    $plan[] = $this->planRow(
                        $row['row_number'],
                        'skip',
                        $values,
                        targetId: (string) $activeMatch['id'],
                        reason: $reason,
                    );

                    continue;
                }

                if ($inactiveMatch !== null) {
                    $plan[] = $this->planRow(
                        $row['row_number'],
                        'skip',
                        $values,
                        targetId: (string) $inactiveMatch['id'],
                        reason: 'Data serupa pernah dinonaktifkan; dilewati untuk mencegah duplikat/zombie.',
                    );

                    continue;
                }
            }

            $plan[] = $this->planRow(
                $row['row_number'],
                'create',
                $values,
                payload: [
                    'name' => $name,
                    'kind' => $kind,
                    'production_id' => $productionResolved['id'],
                    'responsible_id' => $responsibleResolved['id'],
                    'quantity' => $quantityValue ?? 0,
                    'unit' => $unitRaw !== '' ? $unitRaw : 'pcs',
                ],
            );
        }

        return $plan;
    }

    /**
     * @param  array<string, string>  $errors
     */
    private function validateStringField(string $field, string $value, int $min, int $max, bool $required, array &$errors): void
    {
        if ($value === '') {
            if ($required) {
                $errors[$field] = "Kolom {$field} wajib diisi.";
            }

            return;
        }

        if ($this->hasControlChars($value)) {
            $errors[$field] = "Kolom {$field} mengandung karakter kontrol tidak valid.";

            return;
        }

        $len = mb_strlen($value);

        if ($len < $min || $len > $max) {
            $errors[$field] = "Panjang kolom {$field} harus antara {$min} hingga {$max} karakter.";
        }
    }

    private function hasControlChars(string $value): bool
    {
        return preg_match('/[\x00-\x1F\x7F]/', $value) === 1;
    }

    /**
     * @param  list<string>  $parts
     */
    private function naturalKey(array $parts): string
    {
        return implode("\0", array_map(static fn (string $v): string => mb_strtolower(trim($v)), $parts));
    }

    /**
     * @param  array<string, array<string, mixed>>  $recordsById
     * @param  list<string>  $fields
     * @return array<string, array{aktif: list<array<string, mixed>>, nonaktif: list<array<string, mixed>>}>
     */
    private function indexByNaturalKey(array $recordsById, array $fields): array
    {
        $index = [];

        foreach ($recordsById as $record) {
            $keyParts = [];

            foreach ($fields as $field) {
                $keyParts[] = (string) ($record[$field] ?? '');
            }

            $nk = $this->naturalKey($keyParts);
            $bucket = ($record['status'] ?? null) === 'aktif' ? 'aktif' : 'nonaktif';
            $index[$nk][$bucket][] = $record;
        }

        return $index;
    }

    /**
     * @param  array<string, array<string, mixed>>  $peopleById
     */
    private function displayPerson(mixed $id, array $peopleById): ?string
    {
        if (! is_string($id) || $id === '') {
            return null;
        }

        $record = $this->resolver->findByUuidCaseInsensitive($id, $peopleById);

        return $record !== null ? $this->resolver->formatPersonLabel($record) : $id;
    }

    /**
     * @param  array<string, array<string, mixed>>  $productionsById
     */
    private function displayProduction(mixed $id, array $productionsById): ?string
    {
        if (! is_string($id) || $id === '') {
            return null;
        }

        $record = $this->resolver->findByUuidCaseInsensitive($id, $productionsById);

        return $record !== null ? $this->resolver->formatProductionLabel($record) : $id;
    }

    /**
     * @param  array<string, string>  $values
     * @param  array<string, mixed>|null  $payload
     * @param  array<string, array{old: mixed, new: mixed}>|null  $diff
     * @return array<string, mixed>
     */
    private function planRow(
        int $rowNumber,
        string $action,
        array $values,
        ?string $targetId = null,
        ?int $expectedVersion = null,
        ?string $expectedUpdatedAt = null,
        ?array $payload = null,
        ?array $diff = null,
        ?string $reason = null,
    ): array {
        return [
            'row_number' => $rowNumber,
            'action' => $action,
            'target_id' => $targetId,
            'expected_version' => $expectedVersion,
            'expected_updated_at' => $expectedUpdatedAt,
            'values' => $values,
            'payload' => $payload,
            'diff' => $diff,
            'reason' => $reason,
            'errors' => [],
        ];
    }

    /**
     * @param  array<string, string>  $values
     * @param  array<string, string>  $errors
     * @return array<string, mixed>
     */
    private function invalidRow(int $rowNumber, array $values, array $errors): array
    {
        return [
            'row_number' => $rowNumber,
            'action' => 'invalid',
            'target_id' => null,
            'expected_version' => null,
            'expected_updated_at' => null,
            'values' => $values,
            'payload' => null,
            'diff' => null,
            'reason' => implode(' ', array_values($errors)),
            'errors' => $errors,
        ];
    }
}
