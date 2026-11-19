<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AppLog extends Model
{
    use HasFactory;

    protected $table = 'app_logs';

    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'occurred_at',
        'level',
        'message',
        'actor',
        'request_id',
        'context',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'occurred_at' => 'datetime',
            'context' => 'array',
        ];
    }
}
