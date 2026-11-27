<?php

namespace App\Jobs;

use App\Services\Imports\ImportExecutionService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class ProcessDataImportChunk implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 120;

    public function __construct(
        public readonly int $importId,
        public readonly int $backoffAttempt = 0,
    ) {
        $this->onQueue('default');
    }

    public function handle(ImportExecutionService $service): void
    {
        $service->processChunk($this->importId, $this->backoffAttempt);
    }
}
