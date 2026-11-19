<?php

use App\Http\Controllers\Api\V1\LogController;
use App\Http\Controllers\Api\V1\ProductionController;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

RateLimiter::for('api', function (Request $request) {
    return Limit::perMinute((int) config('produksi.rate_limit_per_minute', 120))
        ->by($request->header('X-Service-Key') ?: $request->ip());
});

Route::prefix('v1')
    ->middleware(['service.key', 'throttle:api'])
    ->group(function () {
        Route::get('/logs', [LogController::class, 'index']);

        Route::get('/productions', [ProductionController::class, 'index']);
        Route::post('/productions', [ProductionController::class, 'store']);
        Route::get('/productions/{id}', [ProductionController::class, 'show']);
        Route::patch('/productions/{id}', [ProductionController::class, 'update']);
        Route::delete('/productions/{id}', [ProductionController::class, 'destroy']);
    });
