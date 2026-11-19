<?php

use App\Http\Controllers\Api\V1\ItemController;
use App\Http\Controllers\Api\V1\LogController;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

RateLimiter::for('api', function (Request $request) {
    return Limit::perMinute((int) config('gudang.rate_limit_per_minute', 120))
        ->by($request->header('X-Service-Key') ?: $request->ip());
});

Route::prefix('v1')
    ->middleware(['service.key', 'throttle:api'])
    ->group(function () {
        Route::get('/logs', [LogController::class, 'index']);

        Route::get('/items', [ItemController::class, 'index']);
        Route::post('/items', [ItemController::class, 'store']);
        Route::get('/items/kinds', [ItemController::class, 'kinds']);
        Route::get('/items/{id}', [ItemController::class, 'show']);
        Route::patch('/items/{id}', [ItemController::class, 'update']);
        Route::delete('/items/{id}', [ItemController::class, 'destroy']);
    });
