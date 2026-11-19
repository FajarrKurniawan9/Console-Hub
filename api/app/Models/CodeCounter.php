<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string $counter_key
 * @property int $last_value
 */
#[Fillable(['counter_key', 'last_value'])]
class CodeCounter extends Model
{
    protected $primaryKey = 'counter_key';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;
}
