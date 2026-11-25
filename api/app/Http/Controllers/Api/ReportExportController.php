<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReportExportStoreRequest;
use App\Http\Resources\ReportExportResource;
use App\Jobs\ProcessReportExport;
use App\Models\ReportExport;
use App\Models\User;
use App\Services\Audit;
use App\Services\Reports\ReportExportCanceller;
use App\Services\Reports\ReportExportProcessor;
use App\Services\Reports\ReportFileWriter;
use App\Services\Reports\ReportScheduleResolver;
use App\Support\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportExportController extends Controller
{
    /**
     * Shared active waiting list (FIFO across all users), own scheduled exports, and own finished history.
     * Supports optional `?status=active|scheduled|history`.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $filter = is_string($request->query('status')) ? trim($request->query('status')) : '';

        $active = ($filter === '' || $filter === 'active')
            ? ReportExport::query()
                ->with('user:id,name')
                ->whereIn('status', ReportExport::ACTIVE_STATUSES)
                ->orderByRaw("CASE WHEN status = 'processing' THEN 0 ELSE 1 END ASC")
                ->orderBy('id')
                ->get()
            : collect();

        $positions = [];
        foreach ($active->values() as $index => $item) {
            $positions[$item->id] = $index + 1;
        }

        $scheduled = ($filter === '' || $filter === 'scheduled')
            ? ReportExport::query()
                ->with('user:id,name')
                ->where('user_id', $user->id)
                ->where('status', ReportExport::STATUS_SCHEDULED)
                ->orderBy('scheduled_at')
                ->orderBy('id')
                ->get()
            : collect();

        $history = ($filter === '' || $filter === 'history')
            ? ReportExport::query()
                ->with('user:id,name')
                ->where('user_id', $user->id)
                ->whereNotIn('status', [...ReportExport::ACTIVE_STATUSES, ReportExport::STATUS_SCHEDULED])
                ->orderByDesc('id')
                ->limit(50)
                ->get()
            : collect();

        $combined = $active->concat($scheduled)->concat($history)->all();

        return response()->json([
            'data' => ReportExportResource::many($combined, $positions),
        ]);
    }

    /**
     * Queue a new immediate export ticket or persist a scheduled/recurring export.
     */
    public function store(ReportExportStoreRequest $request, Audit $audit, ReportScheduleResolver $scheduleResolver): JsonResponse
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

        $schedule = $scheduleResolver->resolve($validated);
        $isScheduled = $schedule['schedule_type'] !== ReportExport::SCHEDULE_IMMEDIATE;

        $export = ReportExport::query()->create([
            'user_id' => $user->id,
            'requester_role' => $user->role->code,
            'type' => $type,
            'name' => $name,
            'format' => $format,
            'status' => $isScheduled ? ReportExport::STATUS_SCHEDULED : ReportExport::STATUS_PENDING,
            'schedule_type' => $schedule['schedule_type'],
            'cron_expression' => $schedule['cron_expression'],
            'timezone' => $schedule['timezone'],
            'scheduled_at' => $schedule['scheduled_at'],
            'filters' => $filters,
        ]);

        if ($isScheduled) {
            $audit->record('report.export_scheduled', 'report_export', (string) $export->id, null, [
                'type' => $type,
                'format' => $format,
                'name' => $name,
                'schedule_type' => $schedule['schedule_type'],
                'cron_expression' => $schedule['cron_expression'],
                'scheduled_at' => $schedule['scheduled_at']?->utc()->toIso8601ZuluString(),
            ]);
        } else {
            $audit->record('report.export_requested', 'report_export', (string) $export->id, null, [
                'type' => $type,
                'format' => $format,
                'name' => $name,
            ]);

            ProcessReportExport::dispatch($export->id)->onQueue('exports');
        }

        $export->refresh()->load('user:id,name');
        $position = $export->isActive() ? $this->positionFor($export->id) : null;

        return response()->json([
            'data' => new ReportExportResource($export, $position),
        ], 202);
    }

    /**
     * Cancel a `scheduled` or `pending` export ticket owned by the authenticated user and purge queued jobs.
     */
    public function cancel(Request $request, ReportExport $export, ReportExportCanceller $canceller, Audit $audit): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($export->user_id !== $user->id || ! $user->hasPermission(ReportExport::permissionFor($export->type))) {
            throw new ApiException(403, 'FORBIDDEN', 'Akses ditolak.');
        }

        if (! $canceller->cancel($export)) {
            throw new ApiException(409, 'CONFLICT', 'Tiket ekspor tidak dapat dibatalkan karena sudah diproses atau selesai.');
        }

        $audit->record('report.export_cancelled', 'report_export', (string) $export->id, null, [
            'type' => $export->type,
            'format' => $export->format,
            'schedule_type' => $export->schedule_type,
        ]);

        $export->refresh()->load('user:id,name');

        return response()->json([
            'data' => new ReportExportResource($export),
        ]);
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
