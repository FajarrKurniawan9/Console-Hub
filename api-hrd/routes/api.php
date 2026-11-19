<?php

use App\Http\Controllers\Api\V1\LogController;
use App\Http\Controllers\Api\V1\PersonController;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

RateLimiter::for('api', function (Request $request) {
    return Limit::perMinute((int) config('hr.rate_limit_per_minute', 120))
        ->by($request->header('X-Service-Key') ?: $request->ip());
});

Route::prefix('v1')
    ->middleware(['service.key', 'throttle:api'])
    ->group(function () {
        Route::get('/logs', [LogController::class, 'index']);

        Route::get('/people', [PersonController::class, 'index']);
        Route::post('/people', [PersonController::class, 'store']);
        Route::get('/people/{id}', [PersonController::class, 'show']);
        Route::patch('/people/{id}', [PersonController::class, 'update']);
        Route::delete('/people/{id}', [PersonController::class, 'destroy']);
    });
