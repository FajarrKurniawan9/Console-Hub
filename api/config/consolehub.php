<?php

return [

    /*
    | Allow console base URLs on private, loopback and link-local addresses.
    | Only enable this in local development.
    */
    'allow_private_hosts' => (bool) env('ALLOW_PRIVATE_HOSTS', false),

    'default_timeout_seconds' => 8,

    'slow_threshold_ms' => 2000,

];
