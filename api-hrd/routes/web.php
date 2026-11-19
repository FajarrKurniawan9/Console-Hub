<?php

use App\Http\Controllers\HealthController;
use Illuminate\Support\Facades\Route;

Route::get('/health', [HealthController::class, 'show']);
Route::get('/', function () {
    return response()->json([
        'service' => 'api-hrd',
        'status' => 'running',
    ]);
});
