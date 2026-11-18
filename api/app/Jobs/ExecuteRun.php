<?php

namespace App\Jobs;

use App\Models\ProcessRun;
use App\Services\ProcessRunner;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class ExecuteRun implements ShouldQueue
{
    use Queueable;

    public int $timeout = 120;

    /** Retries are handled by the process engine, never by the queue. */
    public int $tries = 1;

    public function __construct(public string $runId)
    {
        $this->onQueue('runs');
    }

    public function handle(ProcessRunner $runner): void
    {
        $run = ProcessRun::query()->find($this->runId);

        if ($run) {
            $runner->run($run);
        }
    }

    public function failed(?Throwable $exception): void
    {
        ProcessRun::query()->whereKey($this->runId)->whereIn('status', ['queued', 'running'])->update([
            'status' => 'failed',
            'error_summary' => 'Eksekusi terhenti karena kesalahan internal.',
            'finished_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
