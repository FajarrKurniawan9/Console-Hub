<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ConsoleController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:login');

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::get('auth/me', [AuthController::class, 'me']);

        Route::get('consoles', [ConsoleController::class, 'index']);
        Route::get('consoles/{console}', [ConsoleController::class, 'show']);
        Route::post('consoles/{console}/test', [ConsoleController::class, 'test']);

        Route::middleware('admin')->group(function () {
            Route::post('consoles', [ConsoleController::class, 'store']);
            Route::patch('consoles/{console}', [ConsoleController::class, 'update']);
            Route::delete('consoles/{console}', [ConsoleController::class, 'destroy']);
        });
    });
});
