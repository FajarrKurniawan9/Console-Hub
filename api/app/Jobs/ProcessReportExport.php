<?php

namespace App\Jobs;

use App\Services\Reports\ReportExportProcessor;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class ProcessReportExport implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 120;

    public function __construct(public readonly int $exportId)
    {
        $this->onQueue('exports');
    }

    public function handle(ReportExportProcessor $processor): void
    {
        $processor->claimAndProcess($this->exportId);
    }
}
