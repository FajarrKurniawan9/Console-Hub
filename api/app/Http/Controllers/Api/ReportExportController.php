<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReportExportStoreRequest;
use App\Http\Resources\ReportExportResource;
use App\Jobs\ProcessReportExport;
use App\Models\ReportExport;
use App\Models\User;
use App\Services\Audit;
use App\Services\Reports\ReportExportProcessor;
use App\Services\Reports\ReportFileWriter;
use App\Support\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportExportController extends Controller
{
    /**
     * Shared active waiting list (FIFO across all users) followed by the authenticated user's own history.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $active = ReportExport::query()
            ->with('user:id,name')
            ->whereIn('status', ReportExport::ACTIVE_STATUSES)
            ->orderByRaw("CASE WHEN status = 'processing' THEN 0 ELSE 1 END ASC")
            ->orderBy('id')
            ->get();

        $positions = [];
        foreach ($active->values() as $index => $item) {
            $positions[$item->id] = $index + 1;
        }

        $history = ReportExport::query()
            ->with('user:id,name')
            ->where('user_id', $user->id)
            ->whereNotIn('status', ReportExport::ACTIVE_STATUSES)
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        $combined = $active->concat($history)->all();

        return response()->json([
            'data' => ReportExportResource::many($combined, $positions),
        ]);
    }

    /**
     * Queue a new export ticket on the `exports` queue.
     */
    public function store(ReportExportStoreRequest $request, Audit $audit): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $validated = $request->validated();

        /** @var string $type */
        $type = $validated['type'];
        $requiredPermission = ReportExport::permissionFor($type);

        if (! $user->hasPermission($requiredPermission)) {
            throw new ApiException(403, 'FORBIDDEN', 'Akses ditolak.');
        }

        /** @var string $format */
        $format = $validated['format'] ?? 'csv';
        $rawName = is_string($validated['name'] ?? null) ? trim($validated['name']) : '';
        $name = $rawName !== '' ? $rawName : ReportExport::defaultNameFor($type, $format);
        $filters = is_array($validated['filters'] ?? null) ? $validated['filters'] : null;

        $export = ReportExport::query()->create([
            'user_id' => $user->id,
            'requester_role' => $user->role->code,
            'type' => $type,
            'name' => $name,
            'format' => $format,
            'status' => ReportExport::STATUS_PENDING,
            'filters' => $filters,
        ]);

        $audit->record('report.export_requested', 'report_export', (string) $export->id, null, [
            'type' => $type,
            'format' => $format,
            'name' => $name,
        ]);

        ProcessReportExport::dispatch($export->id)->onQueue('exports');

        $export->refresh()->load('user:id,name');
        $position = $export->isActive() ? $this->positionFor($export->id) : null;

        return response()->json([
            'data' => new ReportExportResource($export, $position),
        ], 202);
    }

    /**
     * Stream a completed export file exclusively to its owner with active RBAC permission.
     */
    public function download(Request $request, ReportExport $export): StreamedResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($export->user_id !== $user->id || ! $user->hasPermission(ReportExport::permissionFor($export->type))) {
            throw new ApiException(403, 'FORBIDDEN', 'Akses ditolak.');
        }

        if ($export->status !== ReportExport::STATUS_COMPLETED) {
            throw new ApiException(409, 'CONFLICT', 'Ekspor belum selesai diproses.');
        }

        if ($export->file_path === null || ! Storage::disk(ReportExportProcessor::DISK)->exists($export->file_path)) {
            throw new ApiException(404, 'NOT_FOUND', 'File ekspor sudah tidak tersedia atau telah kedaluwarsa.');
        }

        $filename = $this->safeFilename($export);

        return Storage::disk(ReportExportProcessor::DISK)->download(
            $export->file_path,
            $filename,
            ['Content-Type' => ReportFileWriter::mimeTypeFor($export->format)],
        );
    }

    private function positionFor(int $exportId): ?int
    {
        $activeIds = ReportExport::query()
            ->whereIn('status', ReportExport::ACTIVE_STATUSES)
            ->orderByRaw("CASE WHEN status = 'processing' THEN 0 ELSE 1 END ASC")
            ->orderBy('id')
            ->pluck('id')
            ->all();

        $index = array_search($exportId, $activeIds, true);

        return $index === false ? null : $index + 1;
    }

    private function safeFilename(ReportExport $export): string
    {
        $base = preg_replace('/[^A-Za-z0-9._-]+/', '-', trim($export->name)) ?? '';
        $base = trim($base, '.-');

        if ($base === '') {
            $base = "export-{$export->type}-{$export->id}";
        }

        $suffix = '.'.$export->format;

        return str_ends_with(strtolower($base), strtolower($suffix)) ? $base : $base.$suffix;
    }
}
