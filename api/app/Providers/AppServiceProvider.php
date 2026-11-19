<?php

namespace App\Providers;

use App\Support\DatabaseGuard;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Console\Events\CommandStarting;
use Illuminate\Database\Events\ConnectionEstablished;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(120)->by($request->user()?->id ?: $request->ip()));

        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(5)->by(strtolower((string) $request->input('email')).'|'.$request->ip()));

        $this->guardDatabase();
    }

    /**
     * Every new database connection (web, queue, scheduler, migrate, seed) must point at `console-test`.
     * Tests run on their own local database and are exempt.
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
