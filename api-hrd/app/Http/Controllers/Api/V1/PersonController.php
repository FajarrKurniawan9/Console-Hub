<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Resources\PersonResource;
use App\Models\Person;
use App\Services\AppLogService;
use App\Support\Cursor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class PersonController extends Controller
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

            $people = Person::query()
                ->whereIn('id', $ids)
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->get();

            return response()->json([
                'data' => PersonResource::collection($people),
                'meta' => ['next_cursor' => null],
            ]);
        }

        $query = Person::query();

        $status = $request->query('status', 'aktif');
        if ($status !== 'all') {
            if (! in_array($status, ['aktif', 'nonaktif'], true)) {
                throw ApiException::validation([
                    'status' => ['Status harus salah satu dari: aktif, nonaktif, all.'],
                ]);
            }
            $query->where('status', $status);
        }

        if ($request->filled('role')) {
            $query->where('role', (string) $request->query('role'));
        }

        if ($request->filled('q')) {
            $q = strtolower(trim((string) $request->query('q')));
            $like = '%'.addcslashes($q, '%_\\').'%';
            $query->where(function ($sub) use ($like) {
                $sub->whereRaw('lower(name) LIKE ?', [$like])
                    ->orWhereRaw('lower(role) LIKE ?', [$like]);
            });
        }

        $limit = (int) $request->query('limit', 25);
        if ($limit < 1 || $limit > 100) {
            $limit = min(100, max(1, $limit));
        }

        [$people, $nextCursor] = Cursor::paginate($query, 'created_at', $request->query('cursor'), $limit);

        return response()->json([
            'data' => PersonResource::collection($people),
            'meta' => ['next_cursor' => $nextCursor],
        ]);
    }

    public function show(string $id): JsonResponse
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound();
        }

        $person = Person::query()->find($id);
        if (! $person) {
            throw ApiException::notFound();
        }

        return response()->json([
            'data' => new PersonResource($person),
        ]);
    }

    public function store(Request $request, AppLogService $logger): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'role' => ['required', 'string', 'min:2', 'max:60'],
            'id' => ['nullable', 'uuid'],
        ]);

        if ($validator->fails()) {
            throw ApiException::validation($validator->errors()->toArray());
        }

        $validated = $validator->validated();

        if (! empty($validated['id'])) {
            if (Person::query()->where('id', $validated['id'])->exists()) {
                throw ApiException::duplicate('Personel dengan ID ini sudah terdaftar.');
            }
        }

        $person = new Person;
        if (! empty($validated['id'])) {
            $person->id = $validated['id'];
        }
        $person->name = $validated['name'];
        $person->role = $validated['role'];
        $person->status = 'aktif';
        $person->version = 1;
        $person->save();

        $logger->info('person.created', [
            'person_id' => $person->id,
            'name' => $person->name,
            'role' => $person->role,
        ], $request);

        return response()->json([
            'data' => new PersonResource($person),
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
            'role' => ['sometimes', 'required', 'string', 'min:2', 'max:60'],
        ]);

        if ($validator->fails()) {
            throw ApiException::validation($validator->errors()->toArray());
        }

        $validated = $validator->validated();

        $person = Person::query()->find($id);
        if (! $person) {
            throw ApiException::notFound();
        }

        $expectedVersion = (int) $validated['expected_version'];
        if ((int) $person->version !== $expectedVersion) {
            throw ApiException::versionConflict((int) $person->version);
        }

        $updates = [];
        if (array_key_exists('name', $validated)) {
            $updates['name'] = $validated['name'];
        }
        if (array_key_exists('role', $validated)) {
            $updates['role'] = $validated['role'];
        }

        $updates['version'] = $expectedVersion + 1;
        $updates['updated_at'] = now();

        $affected = DB::table('people')
            ->where('id', $id)
            ->where('version', $expectedVersion)
            ->update($updates);

        if ($affected === 0) {
            $current = Person::query()->find($id);
            throw ApiException::versionConflict($current ? (int) $current->version : (int) $person->version);
        }

        $person->refresh();

        $logger->info('person.updated', [
            'person_id' => $person->id,
            'version' => $person->version,
            'changes' => array_keys($updates),
        ], $request);

        return response()->json([
            'data' => new PersonResource($person),
        ]);
    }

    public function destroy(Request $request, string $id, AppLogService $logger): JsonResponse
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound();
        }

        $expectedVersionParam = $request->query('expected_version');
        if ($expectedVersionParam === null || ! is_numeric($expectedVersionParam) || (int) $expectedVersionParam < 1) {
            throw ApiException::validation([
                'expected_version' => ['Parameter query expected_version wajib diisi dengan integer positif.'],
            ]);
        }

        $expectedVersion = (int) $expectedVersionParam;

        $person = Person::query()->find($id);
        if (! $person) {
            throw ApiException::notFound();
        }

        if ((int) $person->version !== $expectedVersion) {
            throw ApiException::versionConflict((int) $person->version);
        }

        $affected = DB::table('people')
            ->where('id', $id)
            ->where('version', $expectedVersion)
            ->update([
                'status' => 'nonaktif',
                'version' => $expectedVersion + 1,
                'updated_at' => now(),
            ]);

        if ($affected === 0) {
            $current = Person::query()->find($id);
            throw ApiException::versionConflict($current ? (int) $current->version : (int) $person->version);
        }

        $person->refresh();

        $logger->info('person.deactivated', [
            'person_id' => $person->id,
            'version' => $person->version,
        ], $request);

        return response()->json([
            'data' => new PersonResource($person),
        ]);
    }
}
