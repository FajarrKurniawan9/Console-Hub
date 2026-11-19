<?php

namespace App\Console\Commands;

use App\Services\Tx\Recovery;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('tx:recover')]
#[Description('Lanjutkan transaksi yang terputus (preparing lama, prepared, committing, aborting)')]
class TxRecover extends Command
{
    public function handle(Recovery $recovery): int
    {
        foreach ($recovery->run() as $state => $count) {
            if ($count > 0) {
                $this->line("{$state}: {$count} transaksi ditangani");
            }
        }

        return self::SUCCESS;
    }
}
