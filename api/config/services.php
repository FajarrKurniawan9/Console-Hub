<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'brevo' => [
        'api_key' => env('BREVO_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => (function () {
            $uri = trim((string) env('GOOGLE_REDIRECT_URI', ''), "\"'");
            $railwayDomain = env('RAILWAY_PUBLIC_DOMAIN');
            $appUrl = rtrim((string) env('APP_URL', ''), '/');

            if ($railwayDomain && ($appUrl === '' || str_contains($appUrl, 'localhost'))) {
                $appUrl = 'https://'.$railwayDomain;
            } elseif ($appUrl === '') {
                $appUrl = 'http://localhost:8000';
            }

            if ($uri === '' || str_contains($uri, '${APP_URL}')) {
                return str_replace('${APP_URL}', $appUrl, $uri ?: '${APP_URL}/api/v1/auth/google/callback');
            }

            return $uri;
        })(),
    ],

    'recaptcha' => [
        'secret_key' => env('RECAPTCHA_SECRET_KEY'),
        'enabled' => filter_var(env('RECAPTCHA_ENABLED', true), FILTER_VALIDATE_BOOL),
    ],

    'frontend_url' => env('FRONTEND_URL', 'http://localhost:5173'),

];
