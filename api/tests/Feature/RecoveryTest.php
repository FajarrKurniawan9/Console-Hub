<?php

use App\Jobs\FinishTransaction;
use App\Models\AuditEvent;
use App\Models\Console;
use App\Models\Transaction;
use App\Models\TransactionParticipant;
use App\Services\Tx\Coordinator;
use App\Support\ApiException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

beforeEach(fn () => Queue::fake());

/**
 * A transaction left in $state as if the portal died at that moment.
 *
 * @param  array<string, array{0: string, 1: string}>  $participants  slug => [prepare_state, decision_state]
 */
function strandedTx(string $state, array $participants, int $minutesAgo = 5): Transaction
{
    $tx = Transaction::query()->create([
        'operation' => 'divisi.create', 'entity_type' => 'divisi', 'entity_id' => (string) Str::uuid(),
        'payload' => ['entity' => []], 'state' => $state, 'idempotency_key' => (string) Str::uuid(),
        'result' => ['version' => 1, 'checksum' => str_repeat('a', 40), 'request_hash' => 'x'],
        'decided_at' => in_array($state, ['committing', 'aborting', 'needs_attention'], true) ? now()->subMinutes($minutesAgo) : null,
    ]);
    $tx->forceFill(['created_at' => now()->subMinutes($minutesAgo)])->save();

    foreach ($participants as $slug => [$prepare, $decision]) {
        TransactionParticipant::query()->create([
            'tx_id' => $tx->id, 'console_id' => Console::query()->where('slug', $slug)->value('id'),
            'prepare_state' => $prepare, 'decision_state' => $decision,
        ]);
    }

    return $tx;
}

it('aborts a transaction stuck in preparing for more than 2 minutes', function () {
    fakeConsoles();
    $old = strandedTx('preparing', ['hr' => ['ok', 'pending'], 'gudang' => ['pending', 'pending'], 'produksi' => ['pending', 'pending']], minutesAgo: 3);
    $young = strandedTx('preparing', ['hr' => ['pending', 'pending'], 'gudang' => ['pending', 'pending'], 'produksi' => ['pending', 'pending']], minutesAgo: 1);

    $this->artisan('tx:recover')->expectsOutputToContain('preparing: 1')->assertSuccessful();

    expect($old->refresh()->state)->toBe('aborted')
        ->and($old->decided_at)->not->toBeNull()
        ->and($young->refresh()->state)->toBe('preparing')
        ->and(calls('commit'))->toBe([])
        ->and(calls('abort'))->toHaveCount(3);
});

it('continues the commit of prepared and committing transactions', function (string $state) {
    fakeConsoles();
    $tx = strandedTx($state, ['hr' => ['ok', 'committed'], 'gudang' => ['ok', 'pending'], 'produksi' => ['ok', 'failed']]);

    $this->artisan('tx:recover')->assertSuccessful();

    expect($tx->refresh()->state)->toBe('committed')
        ->and($tx->participants()->pluck('decision_state')->unique()->all())->toBe(['committed'])
        ->and(calls('commit'))->toBe(['gudang commit', 'produksi commit']);
})->with(['prepared', 'committing']);

it('continues an abort', function () {
    fakeConsoles();
    $tx = strandedTx('aborting', ['hr' => ['ok', 'aborted'], 'gudang' => ['refused', 'pending'], 'produksi' => ['ok', 'failed']]);

    $this->artisan('tx:recover')->assertSuccessful();

    expect($tx->refresh()->state)->toBe('aborted')->and(calls('commit'))->toBe([]);
});

it('asks the console first and does not repeat a commit it already applied', function () {
    fakeConsoles(['produksi' => ['status' => ['tx_id' => 'x', 'state' => 'committed']]]);
    $tx = strandedTx('committing', ['hr' => ['ok', 'committed'], 'gudang' => ['ok', 'committed'], 'produksi' => ['ok', 'failed']]);

    $this->artisan('tx:recover')->assertSuccessful();

    expect($tx->refresh()->state)->toBe('committed')
        ->and(calls('status'))->toBe(['produksi status'])
        ->and(calls('commit'))->toBe([]);
});

it('leaves finished and needs_attention transactions alone', function () {
    fakeConsoles();
    strandedTx('committed', ['hr' => ['ok', 'committed']]);
    strandedTx('needs_attention', ['hr' => ['ok', 'failed']]);

    $this->artisan('tx:recover')->assertSuccessful();

    expect(ConsoleCalls::$log)->toBe([]);
});

it('lets Admin IT retry the commit of a needs_attention transaction, keeping the decision', function () {
    $admin = actingAsRole('admin_it');
    fakeConsoles();
    $tx = strandedTx('needs_attention', ['hr' => ['ok', 'committed'], 'gudang' => ['ok', 'committed'], 'produksi' => ['ok', 'failed']], minutesAgo: 10);
    $tx->update(['failure_code' => 'COMMIT_FAILED', 'failure_console' => 'produksi']);
    $decidedAt = $tx->decided_at;

    $resolved = app(Coordinator::class)->resolve($tx, 'retry_commit', $admin);
    expect($resolved->state)->toBe('committing');
    Queue::assertPushed(FinishTransaction::class);

    (new FinishTransaction($tx->id))->handle(app(Coordinator::class));

    expect($tx->refresh()->state)->toBe('committed')
        ->and($tx->decided_at->equalTo($decidedAt))->toBeTrue()
        ->and(AuditEvent::query()->where('action', 'transaction.resolved')->sole()->new_value)->toMatchArray(['action' => 'retry_commit']);
});

it('only aborts a needs_attention transaction while no console has committed', function () {
    $admin = actingAsRole('admin_it');
    fakeConsoles();
    $partly = strandedTx('needs_attention', ['hr' => ['ok', 'committed'], 'gudang' => ['ok', 'failed'], 'produksi' => ['ok', 'failed']]);
    $none = strandedTx('needs_attention', ['hr' => ['ok', 'failed'], 'gudang' => ['ok', 'failed'], 'produksi' => ['ok', 'failed']]);
    $done = strandedTx('committed', ['hr' => ['ok', 'committed']]);

    expect(fn () => app(Coordinator::class)->resolve($partly, 'abort', $admin))
        ->toThrow(fn (ApiException $e) => expect($e->status)->toBe(422)->and($e->errorCode)->toBe('INVALID_ACTION'));
    expect(fn () => app(Coordinator::class)->resolve($done, 'retry_commit', $admin))
        ->toThrow(fn (ApiException $e) => expect($e->errorCode)->toBe('INVALID_ACTION'));

    app(Coordinator::class)->resolve($none, 'abort', $admin);
    (new FinishTransaction($none->id))->handle(app(Coordinator::class));

    expect($none->refresh()->state)->toBe('aborted')
        ->and(AuditEvent::query()->where('action', 'transaction.resolved')->count())->toBe(1);
});

it('gives a retried commit a fresh 5 minutes before needs_attention again', function () {
    $admin = actingAsRole('admin_it');
    fakeConsoles(['produksi' => ['commit' => fn () => Http::response('busy', 503)]]);
    $tx = strandedTx('needs_attention', ['hr' => ['ok', 'committed'], 'gudang' => ['ok', 'committed'], 'produksi' => ['ok', 'failed']], minutesAgo: 30);
    $tx->update(['failure_code' => 'COMMIT_FAILED']);

    app(Coordinator::class)->resolve($tx, 'retry_commit', $admin);
    (new FinishTransaction($tx->id))->handle(app(Coordinator::class));
    expect($tx->refresh()->state)->toBe('committing');

    $this->travel(6)->minutes();
    (new FinishTransaction($tx->id))->handle(app(Coordinator::class));
    expect($tx->refresh()->state)->toBe('needs_attention');
});
