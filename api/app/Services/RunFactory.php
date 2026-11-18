<?php

namespace App\Services;

use App\Jobs\ExecuteRun;
use App\Models\Process;
use App\Models\ProcessRun;
use App\Support\ApiException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Creates runs (fresh or retried) with their step snapshots and dispatches execution.
 */
class RunFactory
{
    public function __construct(private Audit $audit) {}

    /**
     * @param  array<string, mixed>  $input
     */
    public function start(Process $process, array $input): ProcessRun
    {
        if (! $process->is_active) {
            throw ApiException::conflict("Proses \"{$process->name}\" sedang nonaktif.");
        }

        $this->validateInput($process, $input);

        $run = DB::transaction(function () use ($process, $input) {
            $run = ProcessRun::query()->create([
                'process_id' => $process->id,
                'status' => 'queued',
                'input' => $input,
                'triggered_by' => Auth::id(),
            ]);

            foreach ($process->steps as $step) {
                $run->steps()->create([
                    'process_step_id' => $step->id,
                    'position' => $step->position,
                    'name' => $step->name,
                    'console_id' => $step->console_id,
                    'status' => 'pending',
                ]);
            }

            return $run;
        });

        $this->audit->record('run.started', 'run', $run->id, null, ['process' => $process->name, 'input' => $input]);

        ExecuteRun::dispatch($run->id);

        return $run;
    }

    /**
     * Start a new run that copies succeeded steps from a failed run and resumes at the failed step.
     */
    public function retry(ProcessRun $failed): ProcessRun
    {
        $failed->loadMissing(['steps', 'process.steps']);

        $compensated = $failed->steps->contains(fn ($s) => in_array($s->status, ['compensated', 'compensation_failed'], true));

        if ($failed->status !== 'failed' || $compensated) {
            throw ApiException::conflict($compensated
                ? 'Eksekusi yang sudah dikompensasi tidak dapat diulang dari langkah gagal.'
                : 'Hanya eksekusi berstatus gagal yang dapat diulang.');
        }

        $run = DB::transaction(function () use ($failed) {
            $run = ProcessRun::query()->create([
                'process_id' => $failed->process_id,
                'status' => 'queued',
                'input' => $failed->input,
                'triggered_by' => Auth::id(),
                'retry_of' => $failed->id,
            ]);

            $previous = $failed->steps->keyBy('position');

            foreach ($failed->process->steps as $step) {
                $old = $previous->get($step->position);
                $copied = $old && $old->status === 'succeeded';

                $run->steps()->create([
                    'process_step_id' => $step->id,
                    'position' => $step->position,
                    'name' => $step->name,
                    'console_id' => $step->console_id,
                    'status' => $copied ? 'succeeded' : 'pending',
                    ...($copied ? $old->only(['attempt', 'request', 'response_status', 'response_body', 'started_at', 'finished_at', 'duration_ms']) : []),
                ]);
            }

            return $run;
        });

        $this->audit->record('run.retried', 'run', $run->id, null, [
            'process' => $failed->process->name,
            'retry_of' => $failed->id,
            'mode' => 'from_failed',
        ]);

        ExecuteRun::dispatch($run->id);

        return $run;
    }

    public function cancel(ProcessRun $run): ProcessRun
    {
        $updated = ProcessRun::query()
            ->whereKey($run->id)
            ->whereIn('status', ['queued', 'running'])
            ->update(['status' => 'canceled', 'finished_at' => now(), 'updated_at' => now()]);

        if ($updated === 0) {
            throw ApiException::conflict('Eksekusi yang sudah selesai tidak dapat dibatalkan.');
        }

        $run->steps()->where('status', 'pending')->update(['status' => 'skipped', 'updated_at' => now()]);

        $this->audit->record('run.canceled', 'run', $run->id, null, ['process' => $run->process->name]);

        return $run->refresh();
    }

    /**
     * Validate input against the process input_schema (type string/integer, required, min).
     *
     * @param  array<string, mixed>  $input
     */
    private function validateInput(Process $process, array $input): void
    {
        $errors = [];

        foreach ($process->input_schema ?? [] as $key => $spec) {
            $label = $spec['label'] ?? $key;
            $value = $input[$key] ?? null;

            if ($value === null || $value === '') {
                if ($spec['required'] ?? false) {
                    $errors[$key] = ["{$label} wajib diisi."];
                }

                continue;
            }

            if (($spec['type'] ?? 'string') === 'integer') {
                if (! is_int($value)) {
                    $errors[$key] = ["{$label} harus bilangan bulat."];
                } elseif (isset($spec['min']) && $value < $spec['min']) {
                    $errors[$key] = ["{$label} minimal {$spec['min']}."];
                }
            } elseif (! is_string($value)) {
                $errors[$key] = ["{$label} harus teks."];
            } elseif (isset($spec['min']) && mb_strlen($value) < $spec['min']) {
                $errors[$key] = ["{$label} minimal {$spec['min']} karakter."];
            }
        }

        if ($errors !== []) {
            throw ApiException::validation($errors, 'Input proses tidak valid.');
        }
    }
}
