<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Throwable;

class HealthController extends Controller
{
    public function show(): JsonResponse
    {
        try {
            DB::select('SELECT 1');

            return response()->json([
                'status' => 'ok',
            ]);
        } catch (Throwable) {
            return response()->json([
                'status' => 'error',
                'message' => 'Database unreachable',
            ], 503);
        }
    }
}
