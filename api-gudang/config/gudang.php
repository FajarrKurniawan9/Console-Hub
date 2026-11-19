<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Gudang Service Key
    |--------------------------------------------------------------------------
    |
    | Secret key required in the X-Service-Key header for server-to-server
    | communication with the Hub.
    |
    */
    'service_key' => env(
        'GUDANG_SERVICE_KEY',
        env(
            'WAREHOUSE_SERVICE_KEY',
            env('SERVICE_KEY', env('CONSOLE_GUDANG_KEY', 'secret-key-gudang'))
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
