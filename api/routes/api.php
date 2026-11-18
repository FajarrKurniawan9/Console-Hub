<?php

use App\Http\Controllers\Api\AuditController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ConsoleController;
use App\Http\Controllers\Api\LogController;
use App\Http\Controllers\Api\OverviewController;
use App\Http\Controllers\Api\ProcessController;
use App\Http\Controllers\Api\ResourceController;
use App\Http\Controllers\Api\RunController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::prefix('auth')->group(function () {
        Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');
        Route::post('logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
        Route::get('me', [AuthController::class, 'me'])->middleware('auth:sanctum');
    });

    Route::middleware('auth:sanctum')->group(function () {

        Route::get('overview', OverviewController::class);

        Route::get('consoles', [ConsoleController::class, 'index']);
        Route::get('consoles/{console}', [ConsoleController::class, 'show']);
        Route::post('consoles/{console}/test', [ConsoleController::class, 'test']);

        Route::get('logs', [LogController::class, 'index']);
        Route::post('logs/sync', [LogController::class, 'sync']);
        Route::get('logs/{log}', [LogController::class, 'show'])->whereNumber('log');

        Route::get('consoles/{console}/resources', [ResourceController::class, 'index']);
        Route::get('consoles/{console}/resources/{key}', [ResourceController::class, 'show']);
        Route::patch('consoles/{console}/resources/{key}/{recordId}', [ResourceController::class, 'update']);

        Route::get('processes', [ProcessController::class, 'index']);
        Route::get('processes/{process}', [ProcessController::class, 'show']);
        Route::post('processes/{process}/runs', [ProcessController::class, 'run']);

        Route::get('runs', [RunController::class, 'index']);
        Route::get('runs/{run}', [RunController::class, 'show']);
        Route::post('runs/{run}/retry', [RunController::class, 'retry']);
        Route::post('runs/{run}/cancel', [RunController::class, 'cancel']);

        Route::middleware('admin')->group(function () {
            Route::post('consoles', [ConsoleController::class, 'store']);
            Route::patch('consoles/{console}', [ConsoleController::class, 'update']);
            Route::delete('consoles/{console}', [ConsoleController::class, 'destroy']);

            Route::post('processes', [ProcessController::class, 'store']);
            Route::put('processes/{process}', [ProcessController::class, 'update']);
            Route::delete('processes/{process}', [ProcessController::class, 'destroy']);

            Route::get('audit', AuditController::class);
        });
    });
});
