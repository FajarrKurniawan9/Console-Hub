<?php

namespace App\Support;

use DateTimeInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Throwable;

/**
 * Keyset pagination over (timestamp column, id) in descending order.
 * The cursor is base64 JSON {<column>: ISO time, id}.
 */
class Cursor
{
    /**
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $query
     * @return array{0: Collection<int, TModel>, 1: string|null}
     */
    public static function paginate(Builder $query, string $column, ?string $cursor, int $limit): array
    {
        $table = $query->getModel()->getTable();

        if ($cursor !== null && $cursor !== '') {
            [$time, $id] = self::decode($cursor, $column);
            $query->whereRaw("({$table}.{$column}, {$table}.id) < (?, ?)", [$time, $id]);
        }

        $rows = $query->orderByDesc("{$table}.{$column}")->orderByDesc("{$table}.id")->limit($limit + 1)->get();
        $next = null;

        if ($rows->count() > $limit) {
            $rows = $rows->take($limit);
            $last = $rows->last();
            $next = self::encode($column, $last->getAttribute($column), $last->getKey());
        }

        return [$rows->values(), $next];
    }

    public static function encode(string $column, DateTimeInterface $time, int|string $id): string
    {
        return rtrim(strtr(base64_encode((string) json_encode([
            $column => Carbon::instance($time)->utc()->format('Y-m-d\TH:i:s.u\Z'),
            'id' => $id,
        ])), '+/', '-_'), '=');
    }

    /**
     * @return array{0: string, 1: int|string}
     */
    private static function decode(string $cursor, string $column): array
    {
        try {
            $data = json_decode((string) base64_decode(strtr($cursor, '-_', '+/'), true), true, flags: JSON_THROW_ON_ERROR);
            $time = Carbon::parse($data[$column])->utc()->format('Y-m-d H:i:s.uP');
            $id = $data['id'];
        } catch (Throwable) {
            throw ApiException::validation(['cursor' => ['Kursor tidak valid.']]);
        }

        if (! is_int($id) && ! is_string($id)) {
            throw ApiException::validation(['cursor' => ['Kursor tidak valid.']]);
        }

        return [$time, $id];
    }
}
