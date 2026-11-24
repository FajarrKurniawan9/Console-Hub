<?php

use App\Http\Controllers\Api\Admin\AuditController;
use App\Http\Controllers\Api\Admin\ConsoleController;
use App\Http\Controllers\Api\Admin\LogController;
use App\Http\Controllers\Api\Admin\OverviewController;
use App\Http\Controllers\Api\Admin\RbacController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\GoogleAuthController;
use App\Http\Controllers\Api\RecordController;
use App\Http\Controllers\Api\TrackingController;
use Illuminate\Support\Facades\Route;

/*
| Portal API v1. Every route below `auth` checks a permission (`perm:kode`); the frontend's menus are
| not a security boundary.
*/
Route::prefix('v1')->group(function () {
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('auth/request-otp', [AuthController::class, 'requestOtp']);
    Route::post('auth/verify-otp', [AuthController::class, 'verifyOtp']);
    Route::get('auth/google/redirect', [GoogleAuthController::class, 'redirect']);
    Route::get('auth/google/callback', [GoogleAuthController::class, 'callback']);
    Route::post('auth/google/exchange', [GoogleAuthController::class, 'exchange']);

    Route::middleware(['auth:sanctum', 'active'])->group(function () {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::get('auth/me', [AuthController::class, 'me']);

        foreach (['items' => 'barang', 'productions' => 'produksi', 'people' => 'personel'] as $resource => $perm) {
            Route::prefix($resource)->controller(RecordController::class)->group(function () use ($resource, $perm) {
                Route::get('/', 'index')->middleware("perm:{$perm}.view")->defaults('resource', $resource);
                Route::post('/', 'store')->middleware("perm:{$perm}.create")->defaults('resource', $resource);
                Route::get('{id}', 'show')->middleware("perm:{$perm}.view")->defaults('resource', $resource);
                Route::patch('{id}', 'update')->middleware("perm:{$perm}.update")->defaults('resource', $resource);
                Route::delete('{id}', 'destroy')->middleware("perm:{$perm}.delete")->defaults('resource', $resource);
            });
        }

        Route::get('tracking/items/{id}', TrackingController::class)->middleware('perm:lacak.view');
        Route::get('dashboard/items', DashboardController::class)->middleware('perm:dashboard.view');

        Route::prefix('admin')->group(function () {
            Route::get('overview', OverviewController::class)->middleware('perm:admin.dashboard.view');

            Route::get('consoles', [ConsoleController::class, 'index'])->middleware('perm:admin.consoles.view');
            Route::get('consoles/{console}', [ConsoleController::class, 'show'])->middleware('perm:admin.consoles.view');
            Route::post('consoles/{console}/test', [ConsoleController::class, 'test'])->middleware('perm:admin.consoles.view');

            Route::middleware('perm:admin.consoles.manage')->group(function () {
                Route::post('consoles', [ConsoleController::class, 'store']);
                Route::patch('consoles/{console}', [ConsoleController::class, 'update']);
                Route::delete('consoles/{console}', [ConsoleController::class, 'destroy']);
            });

            Route::middleware('perm:admin.logs.view')->group(function () {
                Route::get('logs', [LogController::class, 'index']);
                Route::post('logs/sync', [LogController::class, 'sync']);
                Route::get('logs/{log}', [LogController::class, 'show'])->whereNumber('log');
            });

            Route::middleware('perm:admin.rbac.manage')->prefix('rbac')->group(function () {
                Route::get('users', [RbacController::class, 'users']);
                Route::post('users', [RbacController::class, 'storeUser']);
                Route::patch('users/{user}', [RbacController::class, 'updateUser']);
                Route::get('roles', [RbacController::class, 'roles']);
                Route::post('roles', [RbacController::class, 'storeRole']);
                Route::delete('roles/{role}', [RbacController::class, 'destroyRole']);
                Route::get('permissions', [RbacController::class, 'permissions']);
                Route::put('roles/{role}/permissions', [RbacController::class, 'updateRolePermissions']);
            });

            Route::get('audit', AuditController::class)->middleware('perm:admin.audit.view');
        });
    });
});
