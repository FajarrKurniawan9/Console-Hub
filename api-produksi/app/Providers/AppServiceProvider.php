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
        // Defined here, not in routes/api.php: with `route:cache` the routes file is not run, and
        // `throttle:api` would fail with "Rate limiter [api] is not defined".
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute((int) config('produksi.rate_limit_per_minute', 120))
            ->by($request->header('X-Service-Key') ?: $request->ip()));

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
