<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Production extends Model
{
    use HasFactory;

    protected $table = 'productions';

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'id',
        'area',
        'production_type',
        'courier_id',
        'status',
        'version',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'version' => 'integer',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Production $production): void {
            if (empty($production->id)) {
                $production->id = (string) Str::uuid();
            }
            if (empty($production->status)) {
                $production->status = 'aktif';
            }
            if (empty($production->version)) {
                $production->version = 1;
            }
        });
    }
}
