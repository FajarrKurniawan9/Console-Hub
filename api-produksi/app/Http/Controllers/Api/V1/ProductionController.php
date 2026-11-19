<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Resources\ProductionResource;
use App\Models\Production;
use App\Services\AppLogService;
use App\Support\Cursor;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ProductionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->has('ids')) {
            $idsParam = (string) $request->query('ids');
            if (trim($idsParam) === '') {
                return response()->json([
                    'data' => [],
                    'meta' => ['next_cursor' => null],
                ]);
            }

            $ids = array_values(array_filter(array_map('trim', explode(',', $idsParam))));

            if (count($ids) > 100) {
                throw ApiException::validation([
                    'ids' => ['Parameter ids maksimal berisi 100 ID.'],
                ]);
            }

            $validIds = array_values(array_filter($ids, fn (string $id): bool => Str::isUuid($id)));
            if ($validIds === []) {
                return response()->json([
                    'data' => [],
                    'meta' => ['next_cursor' => null],
                ]);
            }

            $productions = Production::query()
                ->whereIn('id', $validIds)
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->get();

            return response()->json([
                'data' => ProductionResource::collection($productions),
                'meta' => ['next_cursor' => null],
            ]);
        }

        $query = Production::query();

        $status = $request->query('status', 'aktif');
        if ($status !== 'all') {
            if (! in_array($status, ['aktif', 'nonaktif'], true)) {
                throw ApiException::validation([
                    'status' => ['Status harus salah satu dari: aktif, nonaktif, all.'],
                ]);
            }
            $query->where('status', $status);
        }

        if ($request->filled('production_type')) {
            $query->where('production_type', (string) $request->query('production_type'));
        }

        if ($request->filled('courier_id')) {
            $courierId = trim((string) $request->query('courier_id'));
            if (! Str::isUuid($courierId)) {
                throw ApiException::validation([
                    'courier_id' => ['Parameter courier_id harus berupa UUID yang valid.'],
                ]);
            }
            $query->where('courier_id', $courierId);
        }

        if ($request->filled('q')) {
            $q = mb_strtolower(trim((string) $request->query('q')));
            $like = '%'.addcslashes($q, '%_\\').'%';
            $query->where(function ($sub) use ($like) {
                $sub->whereRaw('lower(area) LIKE ?', [$like])
                    ->orWhereRaw('lower(production_type) LIKE ?', [$like]);
            });
        }

        $limit = (int) $request->query('limit', 25);
        if ($limit < 1 || $limit > 100) {
            $limit = min(100, max(1, $limit));
        }

        [$productions, $nextCursor] = Cursor::paginate($query, 'created_at', $request->query('cursor'), $limit);

        return response()->json([
            'data' => ProductionResource::collection($productions),
            'meta' => ['next_cursor' => $nextCursor],
        ]);
    }

    public function show(string $id): JsonResponse
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound();
        }

        $production = Production::query()->find($id);
        if (! $production) {
            throw ApiException::notFound();
        }

        return response()->json([
            'data' => new ProductionResource($production),
        ]);
    }

    public function store(Request $request, AppLogService $logger): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'area' => ['required', 'string', 'min:2', 'max:80'],
            'production_type' => ['required', 'string', 'min:2', 'max:80'],
            'courier_id' => ['nullable', 'uuid'],
            'id' => ['nullable', 'uuid'],
        ]);

        if ($validator->fails()) {
            throw ApiException::validation($validator->errors()->toArray());
        }

        $validated = $validator->validated();

        if (! empty($validated['id'])) {
            if (Production::query()->where('id', $validated['id'])->exists()) {
                throw ApiException::duplicate('Produksi dengan ID ini sudah terdaftar.');
            }
        }

        if ($this->hasActiveDuplicate($validated['area'], $validated['production_type'])) {
            throw ApiException::duplicate('Kombinasi area dan jenis produksi yang aktif sudah terdaftar.');
        }

        $production = new Production;
        if (! empty($validated['id'])) {
            $production->id = $validated['id'];
        }
        $production->area = $validated['area'];
        $production->production_type = $validated['production_type'];
        $production->courier_id = $validated['courier_id'] ?? null;
        $production->status = 'aktif';
        $production->version = 1;

        try {
            $production->save();
        } catch (QueryException $e) {
            if ($this->isUniqueConstraintViolation($e)) {
                throw ApiException::duplicate($this->duplicateMessageFromException($e));
            }

            throw $e;
        }

        $logger->info('production.created', [
            'production_id' => $production->id,
            'area' => $production->area,
            'production_type' => $production->production_type,
            'courier_id' => $production->courier_id,
        ], $request);

        return response()->json([
            'data' => new ProductionResource($production),
        ], 201);
    }

    public function update(Request $request, string $id, AppLogService $logger): JsonResponse
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound();
        }

        $validator = Validator::make($request->all(), [
            'expected_version' => ['required', 'integer', 'min:1'],
            'area' => ['sometimes', 'required', 'string', 'min:2', 'max:80'],
            'production_type' => ['sometimes', 'required', 'string', 'min:2', 'max:80'],
            'courier_id' => ['sometimes', 'nullable', 'uuid'],
        ]);

        if ($validator->fails()) {
            throw ApiException::validation($validator->errors()->toArray());
        }

        $validated = $validator->validated();

        $production = Production::query()->find($id);
        if (! $production) {
            throw ApiException::notFound();
        }

        $expectedVersion = (int) $validated['expected_version'];
        if ((int) $production->version !== $expectedVersion) {
            throw ApiException::versionConflict((int) $production->version);
        }

        $targetArea = array_key_exists('area', $validated) ? $validated['area'] : $production->area;
        $targetType = array_key_exists('production_type', $validated) ? $validated['production_type'] : $production->production_type;

        if ($production->status === 'aktif' && $this->hasActiveDuplicate($targetArea, $targetType, $production->id)) {
            throw ApiException::duplicate('Kombinasi area dan jenis produksi yang aktif sudah terdaftar.');
        }

        $updates = [];
        if (array_key_exists('area', $validated)) {
            $updates['area'] = $validated['area'];
        }
        if (array_key_exists('production_type', $validated)) {
            $updates['production_type'] = $validated['production_type'];
        }
        if (array_key_exists('courier_id', $validated)) {
            $updates['courier_id'] = $validated['courier_id'];
        }

        $updates['version'] = $expectedVersion + 1;
        $updates['updated_at'] = now();

        try {
            $affected = DB::table('productions')
                ->where('id', $id)
                ->where('version', $expectedVersion)
                ->update($updates);
        } catch (QueryException $e) {
            if ($this->isUniqueConstraintViolation($e)) {
                throw ApiException::duplicate('Kombinasi area dan jenis produksi yang aktif sudah terdaftar.');
            }

            throw $e;
        }

        if ($affected === 0) {
            $current = Production::query()->find($id);
            throw ApiException::versionConflict($current ? (int) $current->version : (int) $production->version);
        }

        $production->refresh();

        $logger->info('production.updated', [
            'production_id' => $production->id,
            'version' => $production->version,
            'changes' => array_keys($updates),
        ], $request);

        return response()->json([
            'data' => new ProductionResource($production),
        ]);
    }

    public function destroy(Request $request, string $id, AppLogService $logger): JsonResponse
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound();
        }

        $expectedVersionParam = $request->query('expected_version');
        $parsedVersion = filter_var($expectedVersionParam, FILTER_VALIDATE_INT);
        if ($expectedVersionParam === null || $parsedVersion === false || $parsedVersion < 1) {
            throw ApiException::validation([
                'expected_version' => ['Parameter query expected_version wajib diisi dengan integer positif.'],
            ]);
        }

        $expectedVersion = (int) $parsedVersion;

        $production = Production::query()->find($id);
        if (! $production) {
            throw ApiException::notFound();
        }

        if ((int) $production->version !== $expectedVersion) {
            throw ApiException::versionConflict((int) $production->version);
        }

        $affected = DB::table('productions')
            ->where('id', $id)
            ->where('version', $expectedVersion)
            ->update([
                'status' => 'nonaktif',
                'version' => $expectedVersion + 1,
                'updated_at' => now(),
            ]);

        if ($affected === 0) {
            $current = Production::query()->find($id);
            throw ApiException::versionConflict($current ? (int) $current->version : (int) $production->version);
        }

        $production->refresh();

        $logger->info('production.deactivated', [
            'production_id' => $production->id,
            'version' => $production->version,
        ], $request);

        return response()->json([
            'data' => new ProductionResource($production),
        ]);
    }

    private function hasActiveDuplicate(string $area, string $productionType, ?string $excludeId = null): bool
    {
        $query = Production::query()
            ->where('status', 'aktif')
            ->whereRaw('lower(area) = ?', [mb_strtolower($area)])
            ->whereRaw('lower(production_type) = ?', [mb_strtolower($productionType)]);

        if ($excludeId !== null) {
            $query->where('id', '!=', $excludeId);
        }

        return $query->exists();
    }

    private function isUniqueConstraintViolation(QueryException $e): bool
    {
        $sqlState = (string) ($e->errorInfo[0] ?? $e->getCode());
        $message = strtolower($e->getMessage());

        // PostgreSQL unique_violation (23505), including productions_active_unique & productions_pkey
        if ($sqlState === '23505') {
            return true;
        }

        // SQLite UNIQUE / PRIMARY KEY constraint violation
        if ($sqlState === '23000' && str_contains($message, 'unique constraint failed')) {
            return true;
        }

        return false;
    }

    private function duplicateMessageFromException(QueryException $e): string
    {
        $message = strtolower($e->getMessage());

        if (str_contains($message, 'productions_pkey') || str_contains($message, 'productions.id')) {
            return 'Produksi dengan ID ini sudah terdaftar.';
        }

        return 'Kombinasi area dan jenis produksi yang aktif sudah terdaftar.';
    }
}
