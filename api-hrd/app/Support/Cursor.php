<?php

namespace App\Support;

use App\Exceptions\ApiException;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Throwable;

/**
 * Keyset pagination over (timestamp column, id) in descending order.
 * The cursor is URL-safe base64 JSON {<column>: ISO time, id}.
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
        $model = $query->getModel();
        $table = $model->getTable();

        if ($cursor !== null && $cursor !== '') {
            [$time, $id] = self::decode($cursor, $column);

            if ($model->getKeyType() === 'string') {
                if (! is_string($id) || ! Str::isUuid($id)) {
                    throw ApiException::validation(['cursor' => ['Kursor tidak valid.']]);
                }
            } elseif (! is_int($id)) {
                throw ApiException::validation(['cursor' => ['Kursor tidak valid.']]);
            }

            $driver = $query->getConnection()->getDriverName();
            $formattedTime = $driver === 'sqlite'
                ? Carbon::parse($time)->format('Y-m-d H:i:s')
                : Carbon::parse($time)->utc()->format('Y-m-d H:i:s.uP');

            $query->whereRaw("({$table}.{$column}, {$table}.id) < (?, ?)", [$formattedTime, $id]);
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

    public static function encode(string $column, DateTimeInterface|string $time, int|string $id): string
    {
        $carbon = $time instanceof DateTimeInterface ? Carbon::instance($time) : Carbon::parse($time);

        return rtrim(strtr(base64_encode((string) json_encode([
            $column => $carbon->utc()->toISOString(),
            'id' => $id,
        ])), '+/', '-_'), '=');
    }

    /**
     * @return array{0: string, 1: int|string}
     */
    public static function decode(string $cursor, string $column): array
    {
        try {
            $decoded = base64_decode(strtr($cursor, '-_', '+/'), true);
            if ($decoded === false) {
                throw ApiException::validation(['cursor' => ['Kursor tidak valid.']]);
            }

            $data = json_decode($decoded, true, flags: JSON_THROW_ON_ERROR);
            if (! is_array($data) || ! isset($data[$column], $data['id'])) {
                throw ApiException::validation(['cursor' => ['Kursor tidak valid.']]);
            }

            $time = Carbon::parse($data[$column])->utc()->toISOString();
            $id = $data['id'];
        } catch (ApiException $e) {
            throw $e;
        } catch (Throwable) {
            throw ApiException::validation(['cursor' => ['Kursor tidak valid.']]);
        }

        if (! is_int($id) && ! is_string($id)) {
            throw ApiException::validation(['cursor' => ['Kursor tidak valid.']]);
        }

        return [$time, $id];
    }
}
