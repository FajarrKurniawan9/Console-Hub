<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Person extends Model
{
    use HasFactory;

    protected $table = 'people';

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'id',
        'name',
        'role',
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
        static::creating(function (Person $person): void {
            if (empty($person->id)) {
                $person->id = (string) Str::uuid();
            }
            if (empty($person->status)) {
                $person->status = 'aktif';
            }
            if (empty($person->version)) {
                $person->version = 1;
            }
        });
    }
}
