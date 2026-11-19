<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Produksi Service Key
    |--------------------------------------------------------------------------
    |
    | Secret key required in the X-Service-Key header for server-to-server
    | communication with the Hub.
    |
    */
    'service_key' => env(
        'PRODUKSI_SERVICE_KEY',
        env(
            'PRODUCTION_SERVICE_KEY',
            env('SERVICE_KEY', env('CONSOLE_PRODUKSI_KEY', 'secret-key-produksi'))
        )
    ),

    /*
    |--------------------------------------------------------------------------
    | Rate Limiting
    |--------------------------------------------------------------------------
    |
    | Maximum number of requests allowed per minute from the Hub.
    |
    */
    'rate_limit_per_minute' => (int) env('RATE_LIMIT_PER_MINUTE', 120),
];
