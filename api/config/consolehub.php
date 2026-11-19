<?php

return [

    /*
    | Allow console base URLs on private, loopback and link-local addresses.
    | Only enable this in local development.
    */
    'allow_private_hosts' => (bool) env('CONSOLE_ALLOW_PRIVATE_HOSTS', false),

    /* True while the dev console stub (tools/console-stub) stands in for the real consoles. */
    'stub' => (bool) env('CONSOLE_STUB', false),

    'default_timeout_seconds' => 8,

    /* A console answering /health slower than this is shown as "slow". */
    'slow_threshold_ms' => 1500,

    /*
    | The three source APIs, seeded by ConsoleSeeder. Keys come only from .env.
    */
    'consoles' => [
        'hr' => [
            'name' => 'HR',
            'base_url' => env('CONSOLE_HR_URL', 'http://127.0.0.1:9101'),
            'service_key' => env('CONSOLE_HR_KEY'),
            'resource' => 'people',
        ],
        'gudang' => [
            'name' => 'Gudang',
            'base_url' => env('CONSOLE_GUDANG_URL', 'http://127.0.0.1:9102'),
            'service_key' => env('CONSOLE_GUDANG_KEY'),
            'resource' => 'items',
        ],
        'produksi' => [
            'name' => 'Produksi',
            'base_url' => env('CONSOLE_PRODUKSI_URL', 'http://127.0.0.1:9103'),
            'service_key' => env('CONSOLE_PRODUKSI_KEY'),
            'resource' => 'productions',
        ],
    ],

    /*
    | First accounts, seeded by UserSeeder.
    */
    'seed_users' => [
        'admin' => [
            'name' => 'Admin IT',
            'email' => env('SEED_ADMIN_EMAIL', 'admin@example.com'),
            'password' => env('SEED_ADMIN_PASSWORD'),
            'role' => 'admin_it',
        ],
        'user' => [
            'name' => 'User',
            'email' => env('SEED_USER_EMAIL', 'user@example.com'),
            'password' => env('SEED_USER_PASSWORD'),
            'role' => 'user',
        ],
    ],

];
