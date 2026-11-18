<?php

namespace App\Support;

use DateTimeInterface;
use Illuminate\Support\Carbon;

class Iso
{
    /**
     * Format a timestamp as ISO 8601 UTC with a "Z" suffix.
     */
    public static function utc(?DateTimeInterface $date): ?string
    {
        return $date === null ? null : Carbon::instance($date)->utc()->format('Y-m-d\TH:i:s\Z');
    }
}
