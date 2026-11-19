<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('tx:recover')->everyMinute()->withoutOverlapping();
Schedule::command('logs:sync')->everyMinute()->withoutOverlapping();
Schedule::command('consoles:check')->everyMinute()->withoutOverlapping();
Schedule::command('logs:prune')->daily();
