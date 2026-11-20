<?php

use App\Http\Controllers\Api\V1\LogController;
use App\Http\Controllers\Api\V1\PersonController;
use Illuminate\Support\Facades\Route;

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
