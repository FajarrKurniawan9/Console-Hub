<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\DataImportPreviewRequest;
use App\Http\Resources\DataImportResource;
use App\Models\DataImport;
use App\Models\User;
use App\Services\Imports\ImportExecutionService;
use App\Services\Imports\ImportReportWriter;
use App\Services\Imports\ImportTemplateBuilder;
use App\Support\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\UploadedFile;

class DataImportController extends Controller
{
    public function template(Request $request, string $type, ImportTemplateBuilder $builder): Response
    {
        if (! in_array($type, DataImport::TYPES, true)) {
            throw ApiException::validation(['type' => ['Tipe entitas impor tidak valid.']]);
        }

        /** @var User $user */
        $user = $request->user();

        if (! DataImport::userCan($user, $type, DataImport::MODE_CREATE_ONLY)) {
            throw new ApiException(403, 'FORBIDDEN', 'Akses ditolak.');
        }

        $format = strtolower(trim((string) $request->query('format', 'csv')));

        if (! in_array($format, DataImport::FORMATS, true)) {
            throw ApiException::validation(['format' => ['Format template harus csv atau xlsx.']]);
        }

        $built = $builder->build($type, $format);

        return response($built['content'], 200, [
            'Content-Type' => $built['content_type'],
            'Content-Disposition' => 'attachment; filename="'.$built['filename'].'"',
            'Cache-Control' => 'no-store',
        ]);
    }

    public function index(Request $request, ImportExecutionService $service): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $rawType = $request->query('type');
        $type = is_string($rawType) && trim($rawType) !== '' ? trim($rawType) : null;

        if ($type !== null && ! in_array($type, DataImport::TYPES, true)) {
            throw ApiException::validation(['type' => ['Tipe entitas impor tidak valid.']]);
        }

        $imports = DataImport::query()
            ->where('user_id', $user->id)
            ->when($type !== null, fn ($q) => $q->where('type', $type))
            ->orderByDesc('id')
            ->limit(30)
            ->get();

        return response()->json([
            'data' => DataImportResource::summaryCollection($imports),
            'meta' => [
                'active_locks' => $service->activeLocksPayload($user->id, $type),
            ],
        ]);
    }

    public function preview(DataImportPreviewRequest $request, ImportExecutionService $service): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        /** @var string $type */
        $type = $request->validated('type');
        /** @var string $mode */
        $mode = $request->validated('mode');

        if (! DataImport::userCan($user, $type, $mode)) {
            throw new ApiException(403, 'FORBIDDEN', 'Akses ditolak.');
        }

        /** @var UploadedFile $file */
        $file = $request->file('file');
        $import = $service->createPreview($user, $type, $mode, $file);

        return response()->json([
            'data' => new DataImportResource($import, detail: true),
        ], 201);
    }

    public function revalidate(Request $request, DataImport $import, ImportExecutionService $service): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->authorizeImport($user, $import);

        $updated = $service->revalidate($import, $user);

        return response()->json([
            'data' => new DataImportResource($updated, detail: true),
        ]);
    }

    public function commit(Request $request, DataImport $import, ImportExecutionService $service): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->authorizeImport($user, $import);

        $queued = $service->commit($import, $user);

        return response()->json([
            'data' => new DataImportResource($queued, detail: true),
        ], 202);
    }

    public function show(Request $request, DataImport $import): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->authorizeImport($user, $import);

        return response()->json([
            'data' => new DataImportResource($import, detail: true),
        ]);
    }

    public function cancel(Request $request, DataImport $import, ImportExecutionService $service): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->authorizeImport($user, $import);

        $cancelled = $service->cancel($import);

        return response()->json([
            'data' => new DataImportResource($cancelled, detail: true),
        ]);
    }

    public function report(Request $request, DataImport $import, ImportReportWriter $writer): Response
    {
        /** @var User $user */
        $user = $request->user();
        $this->authorizeImport($user, $import);

        $scope = strtolower(trim((string) $request->query('scope', 'all')));

        if (! in_array($scope, ['all', 'errors'], true)) {
            throw ApiException::validation(['scope' => ['Parameter scope harus all atau errors.']]);
        }

        if ($import->status === DataImport::STATUS_EXPIRED
            || (($import->plan_rows === null || $import->plan_rows === [])
                && ($import->execution_results === null || $import->execution_results === []))) {
            throw new ApiException(404, 'NOT_FOUND', 'Laporan impor sudah kedaluwarsa atau tidak tersedia.');
        }

        $csv = $writer->buildCsv($import, $scope);
        $filename = "laporan-import-{$import->type}-{$import->id}-{$scope}.csv";

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            'Cache-Control' => 'no-store',
        ]);
    }

    private function authorizeImport(User $user, DataImport $import): void
    {
        if ($import->user_id !== $user->id || ! DataImport::userCan($user, $import->type, $import->mode)) {
            throw new ApiException(403, 'FORBIDDEN', 'Akses ditolak.');
        }
    }
}
