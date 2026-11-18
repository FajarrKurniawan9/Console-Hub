<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $name
 * @property string $description
 * @property bool $is_active
 * @property array<string, array<string, mixed>> $input_schema
 * @property bool $compensate_on_failure
 * @property int|null $created_by
 */
#[Fillable(['name', 'description', 'is_active', 'input_schema', 'compensate_on_failure', 'created_by'])]
class Process extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'input_schema' => 'array',
            'compensate_on_failure' => 'boolean',
        ];
    }

    /**
     * @return HasMany<ProcessStep, $this>
     */
    public function steps(): HasMany
    {
        return $this->hasMany(ProcessStep::class)->orderBy('position');
    }

    /**
     * @return HasMany<ProcessRun, $this>
     */
    public function runs(): HasMany
    {
        return $this->hasMany(ProcessRun::class);
    }
}
