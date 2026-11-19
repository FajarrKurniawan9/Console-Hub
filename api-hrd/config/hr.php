<?php

return [
    /*
    |--------------------------------------------------------------------------
    | HR Service Key
    |--------------------------------------------------------------------------
    |
    | Secret key required in the X-Service-Key header for server-to-server
    | communication with the Hub.
    |
    */
    'service_key' => env('HR_SERVICE_KEY', env('SERVICE_KEY', env('CONSOLE_HR_KEY', 'secret-key-hr'))),

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
