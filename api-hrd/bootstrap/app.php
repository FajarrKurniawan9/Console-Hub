<?php

use App\Exceptions\ApiException;
use App\Http\Middleware\EnsureRequestId;
use App\Http\Middleware\VerifyServiceKey;
use App\Services\AppLogService;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prepend(EnsureRequestId::class);
        $middleware->alias([
            'service.key' => VerifyServiceKey::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => true,
        );

        $exceptions->render(function (ApiException $e, Request $request) {
            return $e->render($request);
        });

        $exceptions->render(function (ValidationException $e, Request $request) {
            $requestId = $request->header('X-Request-Id');
            $response = response()->json([
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => 'Data yang dikirim tidak valid.',
                    'details' => [
                        'fields' => $e->errors(),
                    ],
                ],
            ], 422);

            if ($requestId) {
                $response->header('X-Request-Id', $requestId);
            }

            return $response;
        });

        $exceptions->render(function (ModelNotFoundException|NotFoundHttpException $e, Request $request) {
            $requestId = $request->header('X-Request-Id');
            $response = response()->json([
                'error' => [
                    'code' => 'NOT_FOUND',
                    'message' => 'Resource tidak ditemukan.',
                    'details' => (object) [],
                ],
            ], 404);

            if ($requestId) {
                $response->header('X-Request-Id', $requestId);
            }

            return $response;
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            $requestId = $request->header('X-Request-Id');
            $response = response()->json([
                'error' => [
                    'code' => 'UNAUTHENTICATED',
                    'message' => 'Kunci layanan tidak valid atau tidak disertakan.',
                    'details' => (object) [],
                ],
            ], 401);

            if ($requestId) {
                $response->header('X-Request-Id', $requestId);
            }

            return $response;
        });

        $exceptions->render(function (ThrottleRequestsException|TooManyRequestsHttpException $e, Request $request) {
            $requestId = $request->header('X-Request-Id');
            $response = response()->json([
                'error' => [
                    'code' => 'RATE_LIMITED',
                    'message' => 'Terlalu banyak permintaan. Silakan coba beberapa saat lagi.',
                    'details' => (object) [],
                ],
            ], 429);

            if ($requestId) {
                $response->header('X-Request-Id', $requestId);
            }

            return $response;
        });

        $exceptions->render(function (Throwable $e, Request $request) {
            if ($e instanceof ApiException) {
                return $e->render($request);
            }

            app(AppLogService::class)->error(
                'Unhandled error: '.$e->getMessage(),
                ['exception' => $e::class, 'file' => $e->getFile(), 'line' => $e->getLine()],
                $request
            );

            $requestId = $request->header('X-Request-Id');
            $response = response()->json([
                'error' => [
                    'code' => 'SERVER_ERROR',
                    'message' => config('app.debug') ? $e->getMessage() : 'Terjadi kesalahan internal pada server.',
                    'details' => (object) [],
                ],
            ], 500);

            if ($requestId) {
                $response->header('X-Request-Id', $requestId);
            }

            return $response;
        });
    })->create();
