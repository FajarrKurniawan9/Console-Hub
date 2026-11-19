<?php

namespace App\Providers;

use App\Support\DatabaseGuard;
use Illuminate\Console\Events\CommandStarting;
use Illuminate\Database\Events\ConnectionEstablished;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->guardDatabase();
    }

    /**
     * Guard database connection and commands against targeting the wrong database.
     */
    private function guardDatabase(): void
    {
        if ($this->app->runningUnitTests()) {
            return;
        }

        Event::listen(ConnectionEstablished::class, fn (ConnectionEstablished $event) => DatabaseGuard::assert($event->connection));

        Event::listen(CommandStarting::class, function (CommandStarting $event) {
            if (in_array($event->command, DatabaseGuard::GUARDED_COMMANDS, true)) {
                $database = $event->input->hasParameterOption('--database')
                    ? (string) $event->input->getParameterOption('--database')
                    : null;
                DatabaseGuard::assert(DB::connection($database));
            }
        });
    }
}
