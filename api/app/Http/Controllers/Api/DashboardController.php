<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditEvent;
use App\Services\Domain\RecordService;
use Carbon\CarbonPeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class DashboardController extends Controller
{
    public function __construct(private RecordService $records) {}

    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'days' => ['nullable', 'integer', 'in:7,14,30'],
        ]);

        $days = (int) ($validated['days'] ?? 7);
        $since = now()->toImmutable()->subDays($days - 1)->startOfDay();

        // 1. Activity Trend from audit_events
        $events = AuditEvent::query()
            ->where('subject_type', 'item')
            ->whereIn('action', ['item.created', 'item.updated', 'item.deactivated'])
            ->where('created_at', '>=', $since)
            ->get(['action', 'created_at']);

        $period = CarbonPeriod::create($since->toDateString(), now()->toDateString());
        $trendByDate = [];
        foreach ($period as $date) {
            $formatted = $date->format('Y-m-d');
            $trendByDate[$formatted] = [
                'date' => $formatted,
                'created' => 0,
                'updated' => 0,
                'deactivated' => 0,
            ];
        }

        foreach ($events as $event) {
            $date = $event->created_at?->format('Y-m-d');
            if ($date && isset($trendByDate[$date])) {
                $type = match ($event->action) {
                    'item.created' => 'created',
                    'item.updated' => 'updated',
                    'item.deactivated' => 'deactivated',
                    default => null,
                };
                if ($type) {
                    $trendByDate[$date][$type]++;
                }
            }
        }

        // 2. Kind distribution and summary from Gudang items
        $items = [];
        try {
            $page = $this->records->list('items', ['limit' => 100, 'status' => 'all']);
            $items = $page['data'];
        } catch (Throwable) {
            // Source may be down or unreachable; gracefully degrade
        }

        $kindMap = [];
        $totalQuantity = 0;
        $totalActive = 0;

        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }
            $kind = (string) ($item['kind'] ?? 'Lainnya');
            $qty = (int) ($item['quantity'] ?? 0);
            $status = (string) ($item['status'] ?? 'aktif');

            if ($status === 'aktif') {
                $totalActive++;
                $totalQuantity += $qty;
            }

            if (! isset($kindMap[$kind])) {
                $kindMap[$kind] = ['kind' => $kind, 'count' => 0, 'total_quantity' => 0];
            }
            $kindMap[$kind]['count']++;
            $kindMap[$kind]['total_quantity'] += $qty;
        }

        usort($kindMap, fn ($a, $b) => $b['total_quantity'] <=> $a['total_quantity']);

        return response()->json([
            'data' => [
                'total_items' => $totalActive ?: count($items),
                'total_quantity' => $totalQuantity,
                'transactions_count' => $events->count(),
                'activity_trend' => array_values($trendByDate),
                'kind_distribution' => array_values($kindMap),
            ],
        ]);
    }
}
