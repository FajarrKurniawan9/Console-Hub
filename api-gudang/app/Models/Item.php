<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Item extends Model
{
    use HasFactory;

    protected $table = 'items';

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'id',
        'name',
        'kind',
        'production_id',
        'responsible_id',
        'quantity',
        'unit',
        'status',
        'version',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'version' => 'integer',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Item $item): void {
            if (empty($item->id)) {
                $item->id = (string) Str::uuid();
            }
            if ($item->quantity === null) {
                $item->quantity = 0;
            }
            if (empty($item->unit)) {
                $item->unit = 'pcs';
            }
            if (empty($item->status)) {
                $item->status = 'aktif';
            }
            if (empty($item->version)) {
                $item->version = 1;
            }
        });
    }
}
