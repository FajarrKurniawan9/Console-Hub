<?php

use App\Http\Controllers\Api\V1\ItemController;
use App\Http\Controllers\Api\V1\LogController;
use Illuminate\Support\Facades\Route;

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
