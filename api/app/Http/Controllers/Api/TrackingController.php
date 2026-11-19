<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\RecordResource;
use App\Services\Domain\Tracker;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TrackingController extends Controller
{
    /**
     * `TrackingResult`; `sources` only for accounts with admin.consoles.view.
     */
    public function __invoke(Request $request, string $id, Tracker $tracker): JsonResponse
    {
        $result = $tracker->track($id);

        return response()->json(['data' => array_filter([
            'item' => new RecordResource($result['item'], 'items'),
            'production' => $result['production'] === null ? null : new RecordResource($result['production'], 'productions'),
            'responsible' => $result['responsible'],
            'courier' => $result['courier'],
            'warnings' => $result['warnings'],
            'sources' => $request->user()?->hasPermission('admin.consoles.view') ? $result['sources'] : null,
        ], fn ($value, $key) => $key !== 'sources' || $value !== null, ARRAY_FILTER_USE_BOTH)]);
    }
}
