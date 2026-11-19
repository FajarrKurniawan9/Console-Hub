<?php

namespace Database\Seeders\Support;

use Ramsey\Uuid\Uuid;

class SeedUuid
{
    public const NAMESPACE = '7a1f6c3e-5b8d-4f21-9a0c-3e2d1b4c5a60';

    public static function slug(string $value): string
    {
        $slug = strtolower(trim($value));
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug);

        return trim((string) $slug, '-');
    }

    public static function forPerson(string $name): string
    {
        return Uuid::uuid5(Uuid::fromString(self::NAMESPACE), 'person:'.self::slug($name))->toString();
    }

    public static function forProduction(string $area, string $type): string
    {
        return Uuid::uuid5(Uuid::fromString(self::NAMESPACE), 'production:'.self::slug($area).':'.self::slug($type))->toString();
    }

    public static function forItem(string $name): string
    {
        return Uuid::uuid5(Uuid::fromString(self::NAMESPACE), 'item:'.self::slug($name))->toString();
    }
}
