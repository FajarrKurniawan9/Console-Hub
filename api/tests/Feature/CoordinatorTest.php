<?php

use App\Jobs\FinishTransaction;
use App\Models\AuditEvent;
use App\Models\Transaction;
use App\Services\Tx\Checksum;
use App\Services\Tx\Coordinator;
use App\Support\ApiException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

beforeEach(function () {
    Queue::fake();
});

it('commits on all three consoles with the same version and checksum', function () {
    $admin = actingAsRole('admin_it');
    fakeConsoles();

    $tx = runTx('divisi.create', ['kode' => 'QA', 'nama' => 'Mutu']);

    expect($tx->state)->toBe('committed')
        ->and($tx->participants->pluck('decision_state')->unique()->all())->toBe(['committed'])
        ->and($tx->participants->pluck('version')->unique()->all())->toBe([1])
        ->and($tx->decided_at)->not->toBeNull()
        ->and($tx->finished_at)->not->toBeNull()
        ->and(calls('prepare'))->toHaveCount(3)
        ->and(calls('commit'))->toHaveCount(3);

    $entity = ['id' => $tx->entity_id, 'code' => 'QA', 'name' => 'Mutu', 'status' => 'aktif'];
    Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/tx/prepare') && $r['payload'] === ['entity' => $entity] && $r['operation'] === 'divisi.create' && $r['tx_id'] === $tx->id && $r->header('X-Service-Key') !== []);
    Http::assertSent(fn (Request $r) => str_ends_with($r->url(), "/tx/{$tx->id}/commit") && $r['version'] === 1 && $r['checksum'] === Checksum::of($entity));
    expect(AuditEvent::query()->where('action', 'divisi.create')->sole()->new_value)->toMatchArray(['tx_id' => $tx->id, 'state' => 'committed', 'code' => 'QA']);
    expect($admin)->not->toBeNull();
});

it('aborts everywhere when one console refuses, and never sends commit', function () {
    actingAsRole('admin_it');
    fakeConsoles(['hr' => ['prepare' => ['vote' => 'refuse', 'code' => 'DUPLICATE_CODE', 'message' => 'Kode QA sudah ada.', 'details' => ['code' => 'QA']]]]);

    try {
        runTx('divisi.create', ['kode' => 'QA', 'nama' => 'Mutu']);
        $this->fail('expected a refusal');
    } catch (ApiException $e) {
        expect($e->status)->toBe(409)->and($e->errorCode)->toBe('TRANSACTION_REFUSED')
            ->and($e->details['refusals'])->toBe([['console' => 'Hr', 'code' => 'DUPLICATE_CODE', 'message' => 'Kode QA sudah ada.']])
            ->and($e->details['tx_id'])->toBeString();
    }

    $tx = Transaction::query()->sole();
    expect($tx->state)->toBe('aborted')
        ->and($tx->failure_code)->toBe('DUPLICATE_CODE')
        ->and($tx->failure_console)->toBe('hr')
        ->and(calls('commit'))->toBe([])
        ->and(calls('abort'))->toHaveCount(3)
        ->and($tx->participants()->pluck('decision_state')->unique()->all())->toBe(['aborted']);
});

it('tells a User the business reason without console names, ids or codes', function () {
    actingAsRole('user');
    fakeConsoles(['gudang' => ['prepare' => ['vote' => 'refuse', 'code' => 'INSUFFICIENT_STOCK', 'message' => 'Stok SKU-BJ-001 kurang 380.', 'details' => ['sku' => 'SKU-BJ-001', 'item_name' => 'Roti tawar', 'available' => 120, 'required' => 500]]]]);

    try {
        runTx('divisi.create', ['kode' => 'QA', 'nama' => 'Mutu']);
        $this->fail('expected a refusal');
    } catch (ApiException $e) {
        expect($e->errorCode)->toBe('TRANSACTION_REFUSED')
            ->and($e->getMessage())->toBe('Pesanan tidak dapat dibuat: stok Roti tawar tidak cukup (tersedia 120, dibutuhkan 500).')
            ->and($e->details)->toBe([])
            ->and($e->getMessage())->not->toContain('Gudang')->not->toContain('INSUFFICIENT');
    }
});

it('aborts with 502 or 504 when a console cannot be reached during prepare', function (string $failure, int $status, string $code) {
    $failure = $failure === 'http500' ? fn () => Http::response('boom', 500) : $failure;
    actingAsRole('admin_it');
    fakeConsoles(['produksi' => ['prepare' => $failure]]);

    try {
        runTx('divisi.create', ['kode' => 'QA', 'nama' => 'Mutu']);
        $this->fail('expected an error');
    } catch (ApiException $e) {
        expect($e->status)->toBe($status)->and($e->errorCode)->toBe($code)->and($e->console)->toBe('produksi');
    }

    expect(Transaction::query()->sole()->state)->toBe('aborted')
        ->and(calls('commit'))->toBe([])
        ->and(calls('abort'))->toHaveCount(3);
})->with([
    'down' => ['down', 502, 'CONSOLE_UNREACHABLE'],
    'timeout' => ['timeout', 504, 'CONSOLE_TIMEOUT'],
    'HTTP 500' => ['http500', 502, 'CONSOLE_ERROR'],
]);

it('gives a User the general service message when a console is down', function () {
    actingAsRole('user');
    fakeConsoles(['gudang' => ['prepare' => 'down']]);

    expect(fn () => runTx('divisi.create', ['kode' => 'QA', 'nama' => 'Mutu']))
        ->toThrow(fn (ApiException $e) => expect($e->getMessage())->not->toContain('Gudang')->and($e->console)->toBeNull()->and($e->details)->toBe([]));
});

it('writes the commit decision to the database before sending any commit', function () {
    actingAsRole('admin_it');
    $seen = [];
    $commit = function (Request $r) use (&$seen) {
        $tx = Transaction::query()->sole();
        $seen[] = [$tx->state, $tx->decided_at !== null];

        return ['state' => 'committed'];
    };
    fakeConsoles(['hr' => ['commit' => $commit], 'gudang' => ['commit' => $commit], 'produksi' => ['commit' => $commit]]);

    runTx('divisi.create', ['kode' => 'QA', 'nama' => 'Mutu']);

    expect($seen)->toHaveCount(3)->each->toBe(['committing', true]);
});

it('answers 202-style (still committing) when a commit keeps failing, and the queue finishes it', function () {
    actingAsRole('admin_it');
    $produksiUp = false;
    fakeConsoles(['produksi' => ['commit' => function () use (&$produksiUp) {
        return $produksiUp ? ['state' => 'committed'] : Http::response('busy', 503);
    }]]);

    $tx = runTx('divisi.create', ['kode' => 'QA', 'nama' => 'Mutu']);

    expect($tx->state)->toBe('committing')
        ->and($tx->participants->firstWhere('console.slug', 'produksi')->decision_state)->toBe('failed')
        ->and($tx->participants->where('decision_state', 'committed'))->toHaveCount(2)
        ->and(calls('commit'))->toHaveCount(2 + 4); // hr+gudang once, produksi in 4 rounds within 10 s
    Queue::assertPushed(FinishTransaction::class, fn ($job) => $job->txId === $tx->id);

    $produksiUp = true;
    (new FinishTransaction($tx->id))->handle(app(Coordinator::class));

    expect($tx->refresh()->state)->toBe('committed')
        ->and(calls('commit'))->toHaveCount(7);
});

it('moves a commit that keeps failing to needs_attention after 5 minutes', function () {
    actingAsRole('admin_it');
    fakeConsoles(['produksi' => ['commit' => fn () => Http::response('busy', 503)]]);
    $tx = runTx('divisi.create', ['kode' => 'QA', 'nama' => 'Mutu']);

    $this->travel(4)->minutes();
    (new FinishTransaction($tx->id))->handle(app(Coordinator::class));
    expect($tx->refresh()->state)->toBe('committing');

    $this->travel(2)->minutes();
    (new FinishTransaction($tx->id))->handle(app(Coordinator::class));

    expect($tx->refresh()->state)->toBe('needs_attention')
        ->and($tx->failure_code)->toBe('COMMIT_FAILED')
        ->and($tx->failure_console)->toBe('produksi')
        ->and($tx->decided_at)->not->toBeNull();
});

it('treats abort as idempotent and finishes when a console answers it again', function () {
    actingAsRole('admin_it');
    $first = true;
    fakeConsoles([
        'hr' => ['prepare' => ['vote' => 'refuse', 'code' => 'LOCKED', 'message' => 'Sedang dipakai transaksi lain.']],
        'gudang' => ['abort' => function () use (&$first) {
            $wasFirst = $first;
            $first = false;

            return $wasFirst ? 'down' : ['state' => 'aborted'];
        }],
    ]);

    expect(fn () => runTx('divisi.create', ['kode' => 'QA', 'nama' => 'Mutu']))
        ->toThrow(fn (ApiException $e) => expect($e->errorCode)->toBe('LOCKED')->and($e->status)->toBe(409));

    $tx = Transaction::query()->sole();
    expect($tx->state)->toBe('aborted');

    // A second round on a finished transaction sends nothing.
    $before = count(ConsoleCalls::$log);
    app(Coordinator::class)->finish($tx);
    expect(count(ConsoleCalls::$log))->toBe($before);
});

it('returns the same transaction for the same key and refuses the key with another payload', function () {
    $user = actingAsRole('admin_it');
    fakeConsoles();
    $key = (string) Str::uuid();

    $first = runTx('divisi.create', ['kode' => 'QA', 'nama' => 'Mutu'], key: $key);
    $again = runTx('divisi.create', ['kode' => 'QA', 'nama' => 'Mutu'], key: $key);

    expect($again->id)->toBe($first->id)
        ->and(Transaction::query()->count())->toBe(1)
        ->and(calls('prepare'))->toHaveCount(3);

    expect(fn () => runTx('divisi.create', ['kode' => 'QB', 'nama' => 'Lain'], key: $key))
        ->toThrow(fn (ApiException $e) => expect($e->status)->toBe(422)->and($e->errorCode)->toBe('IDEMPOTENCY_KEY_REUSED'));

    // The same key from another user is a different intent.
    $other = actingAsRole('admin_it');
    expect(runTx('divisi.create', ['kode' => 'QA', 'nama' => 'Mutu'], key: $key, user: $other)->id)->not->toBe($first->id);
    expect($user->id)->not->toBe($other->id);
});

it('replays the original refusal for a repeated key without calling the consoles', function () {
    actingAsRole('admin_it');
    fakeConsoles(['hr' => ['prepare' => ['vote' => 'refuse', 'code' => 'DUPLICATE_CODE', 'message' => 'Kode QA sudah ada.']]]);
    $key = (string) Str::uuid();

    expect(fn () => runTx('divisi.create', ['kode' => 'QA', 'nama' => 'Mutu'], key: $key))->toThrow(ApiException::class);
    $count = count(ConsoleCalls::$log);
    expect(fn () => runTx('divisi.create', ['kode' => 'QA', 'nama' => 'Mutu'], key: $key))
        ->toThrow(fn (ApiException $e) => expect($e->errorCode)->toBe('TRANSACTION_REFUSED'));
    expect(count(ConsoleCalls::$log))->toBe($count);
});

it('checks expected_version at the owner and stops before prepare on a conflict', function () {
    actingAsRole('admin_it');
    $id = (string) Str::uuid();
    fakeConsoles(['hr' => ['read' => ['data' => ['id' => $id, 'code' => 'QA', 'name' => 'Mutu', 'status' => 'aktif', 'version' => 4]]]]);

    expect(fn () => runTx('divisi.update', ['nama' => 'Mutu Baru', 'expected_version' => 3], $id))
        ->toThrow(fn (ApiException $e) => expect($e->errorCode)->toBe('VERSION_CONFLICT')->and($e->details)->toBe(['current_version' => 4]));
    expect(Transaction::query()->count())->toBe(0)->and(calls('prepare'))->toBe([]);

    $tx = runTx('divisi.update', ['nama' => 'Mutu Baru', 'expected_version' => 4], $id);
    expect($tx->state)->toBe('committed')
        ->and($tx->payload)->toBe(['entity' => ['id' => $id, 'code' => 'QA', 'name' => 'Mutu Baru', 'status' => 'aktif'], 'expected_version' => 4])
        ->and($tx->participants->pluck('version')->unique()->all())->toBe([5]);
    expect(AuditEvent::query()->where('action', 'divisi.update')->sole())
        ->old_value->toMatchArray(['name' => 'Mutu'])
        ->new_value->toMatchArray(['name' => 'Mutu Baru']);
});
