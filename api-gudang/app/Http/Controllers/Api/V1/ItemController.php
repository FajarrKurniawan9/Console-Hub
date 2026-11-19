<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Resources\ItemResource;
use App\Models\Item;
use App\Services\AppLogService;
use App\Support\Cursor;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ItemController extends Controller
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

            $items = Item::query()
                ->whereIn('id', $validIds)
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->get();

            return response()->json([
                'data' => ItemResource::collection($items),
                'meta' => ['next_cursor' => null],
            ]);
        }

        $query = Item::query();

        $status = $request->query('status', 'aktif');
        if ($status !== 'all') {
            if (! in_array($status, ['aktif', 'nonaktif'], true)) {
                throw ApiException::validation([
                    'status' => ['Status harus salah satu dari: aktif, nonaktif, all.'],
                ]);
            }
            $query->where('status', $status);
        }

        if ($request->filled('kind')) {
            $query->where('kind', (string) $request->query('kind'));
        }

        if ($request->filled('production_id')) {
            $productionId = trim((string) $request->query('production_id'));
            if (! Str::isUuid($productionId)) {
                throw ApiException::validation([
                    'production_id' => ['Parameter production_id harus berupa UUID yang valid.'],
                ]);
            }
            $query->where('production_id', $productionId);
        }

        if ($request->filled('responsible_id')) {
            $responsibleId = trim((string) $request->query('responsible_id'));
            if (! Str::isUuid($responsibleId)) {
                throw ApiException::validation([
                    'responsible_id' => ['Parameter responsible_id harus berupa UUID yang valid.'],
                ]);
            }
            $query->where('responsible_id', $responsibleId);
        }

        if ($request->filled('q')) {
            $q = mb_strtolower(trim((string) $request->query('q')));
            $like = '%'.addcslashes($q, '%_\\').'%';
            $query->where(function ($sub) use ($like) {
                $sub->whereRaw('lower(name) LIKE ?', [$like])
                    ->orWhereRaw('lower(kind) LIKE ?', [$like]);
            });
        }

        $limit = (int) $request->query('limit', 25);
        if ($limit < 1 || $limit > 100) {
            $limit = min(100, max(1, $limit));
        }

        [$items, $nextCursor] = Cursor::paginate($query, 'created_at', $request->query('cursor'), $limit);

        return response()->json([
            'data' => ItemResource::collection($items),
            'meta' => ['next_cursor' => $nextCursor],
        ]);
    }

    public function kinds(Request $request): JsonResponse
    {
        $query = Item::query();

        $status = $request->query('status', 'aktif');
        if ($status !== 'all') {
            if (! in_array($status, ['aktif', 'nonaktif'], true)) {
                throw ApiException::validation([
                    'status' => ['Status harus salah satu dari: aktif, nonaktif, all.'],
                ]);
            }
            $query->where('status', $status);
        }

        $kinds = $query
            ->select('kind')
            ->distinct()
            ->orderBy('kind')
            ->pluck('kind')
            ->values()
            ->all();

        return response()->json([
            'data' => $kinds,
        ]);
    }

    public function show(string $id): JsonResponse
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound();
        }

        $item = Item::query()->find($id);
        if (! $item) {
            throw ApiException::notFound();
        }

        return response()->json([
            'data' => new ItemResource($item),
        ]);
    }

    public function store(Request $request, AppLogService $logger): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'kind' => ['required', 'string', 'min:2', 'max:60'],
            'production_id' => ['nullable', 'uuid'],
            'responsible_id' => ['nullable', 'uuid'],
            'quantity' => ['nullable', 'integer', 'min:0'],
            'unit' => ['nullable', 'string', 'min:1', 'max:20'],
            'id' => ['nullable', 'uuid'],
        ]);

        if ($validator->fails()) {
            throw ApiException::validation($validator->errors()->toArray());
        }

        $validated = $validator->validated();

        if (! empty($validated['id'])) {
            if (Item::query()->where('id', $validated['id'])->exists()) {
                throw ApiException::duplicate('Barang dengan ID ini sudah terdaftar.');
            }
        }

        $item = new Item;
        if (! empty($validated['id'])) {
            $item->id = $validated['id'];
        }
        $item->name = $validated['name'];
        $item->kind = $validated['kind'];
        $item->production_id = $validated['production_id'] ?? null;
        $item->responsible_id = $validated['responsible_id'] ?? null;
        $item->quantity = (int) ($validated['quantity'] ?? 0);
        $item->unit = $validated['unit'] ?? 'pcs';
        $item->status = 'aktif';
        $item->version = 1;

        try {
            $item->save();
        } catch (QueryException $e) {
            if ($this->isUniqueConstraintViolation($e)) {
                throw ApiException::duplicate('Barang dengan ID ini sudah terdaftar.');
            }

            throw $e;
        }

        $logger->info('item.created', [
            'item_id' => $item->id,
            'name' => $item->name,
            'kind' => $item->kind,
            'production_id' => $item->production_id,
            'responsible_id' => $item->responsible_id,
            'quantity' => $item->quantity,
            'unit' => $item->unit,
        ], $request);

        return response()->json([
            'data' => new ItemResource($item),
        ], 201);
    }

    public function update(Request $request, string $id, AppLogService $logger): JsonResponse
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound();
        }

        $validator = Validator::make($request->all(), [
            'expected_version' => ['required', 'integer', 'min:1'],
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:120'],
            'kind' => ['sometimes', 'required', 'string', 'min:2', 'max:60'],
            'production_id' => ['sometimes', 'nullable', 'uuid'],
            'responsible_id' => ['sometimes', 'nullable', 'uuid'],
            'quantity' => ['sometimes', 'required', 'integer', 'min:0'],
            'unit' => ['sometimes', 'required', 'string', 'min:1', 'max:20'],
        ]);

        if ($validator->fails()) {
            throw ApiException::validation($validator->errors()->toArray());
        }

        $validated = $validator->validated();

        $item = Item::query()->find($id);
        if (! $item) {
            throw ApiException::notFound();
        }

        $expectedVersion = (int) $validated['expected_version'];
        if ((int) $item->version !== $expectedVersion) {
            throw ApiException::versionConflict((int) $item->version);
        }

        $updates = [];
        if (array_key_exists('name', $validated)) {
            $updates['name'] = $validated['name'];
        }
        if (array_key_exists('kind', $validated)) {
            $updates['kind'] = $validated['kind'];
        }
        if (array_key_exists('production_id', $validated)) {
            $updates['production_id'] = $validated['production_id'];
        }
        if (array_key_exists('responsible_id', $validated)) {
            $updates['responsible_id'] = $validated['responsible_id'];
        }
        if (array_key_exists('quantity', $validated)) {
            $updates['quantity'] = (int) $validated['quantity'];
        }
        if (array_key_exists('unit', $validated)) {
            $updates['unit'] = $validated['unit'];
        }

        $updates['version'] = $expectedVersion + 1;
        $updates['updated_at'] = now();

        $affected = DB::table('items')
            ->where('id', $id)
            ->where('version', $expectedVersion)
            ->update($updates);

        if ($affected === 0) {
            $current = Item::query()->find($id);
            throw ApiException::versionConflict($current ? (int) $current->version : (int) $item->version);
        }

        $item->refresh();

        $logger->info('item.updated', [
            'item_id' => $item->id,
            'version' => $item->version,
            'changes' => array_keys($updates),
        ], $request);

        return response()->json([
            'data' => new ItemResource($item),
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

        $item = Item::query()->find($id);
        if (! $item) {
            throw ApiException::notFound();
        }

        if ((int) $item->version !== $expectedVersion) {
            throw ApiException::versionConflict((int) $item->version);
        }

        $affected = DB::table('items')
            ->where('id', $id)
            ->where('version', $expectedVersion)
            ->update([
                'status' => 'nonaktif',
                'version' => $expectedVersion + 1,
                'updated_at' => now(),
            ]);

        if ($affected === 0) {
            $current = Item::query()->find($id);
            throw ApiException::versionConflict($current ? (int) $current->version : (int) $item->version);
        }

        $item->refresh();

        $logger->info('item.deactivated', [
            'item_id' => $item->id,
            'version' => $item->version,
        ], $request);

        return response()->json([
            'data' => new ItemResource($item),
        ]);
    }

    private function isUniqueConstraintViolation(QueryException $e): bool
    {
        $sqlState = (string) ($e->errorInfo[0] ?? $e->getCode());
        $message = strtolower($e->getMessage());

        // PostgreSQL unique_violation (23505), including items_pkey
        if ($sqlState === '23505') {
            return true;
        }

        // SQLite UNIQUE / PRIMARY KEY constraint violation
        if ($sqlState === '23000' && str_contains($message, 'unique constraint failed')) {
            return true;
        }

        return false;
    }
}
