<?php

use App\Http\Controllers\Api\V1\LogController;
use App\Http\Controllers\Api\V1\ProductionController;
use Illuminate\Support\Facades\Route;

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
