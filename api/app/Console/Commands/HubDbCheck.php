<?php

namespace App\Console\Commands;

use App\Support\DatabaseGuard;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

#[Signature('hub:db-check')]
#[Description('Tampilkan database aktif, host, versi PostgreSQL, SSL, dan tabel portal (tanpa rahasia)')]
class HubDbCheck extends Command
{
    /** @var list<string> */
    private const PORTAL_TABLES = [
        'roles', 'permissions', 'role_permissions', 'users', 'consoles',
        'console_health_checks', 'log_sync_state', 'log_entries', 'audit_events',
        'migrations', 'personal_access_tokens', 'jobs', 'job_batches', 'failed_jobs', 'cache', 'cache_locks', 'sessions',
    ];

    public function handle(): int
    {
        DatabaseGuard::$enabled = false;
        $failed = false;

        foreach (['pgsql', 'pgsql_direct'] as $name) {
            $this->newLine();
            $this->info("[{$name}]");

            try {
                $connection = DB::connection($name);
                $row = $connection->selectOne(
                    "select current_database() as db, current_setting('server_version') as version,
                            coalesce((select ssl from pg_stat_ssl where pid = pg_backend_pid()), false) as ssl"
                );
                $existing = collect($connection->select("select tablename from pg_tables where schemaname = 'public'"))
                    ->pluck('tablename')->all();
                $missing = array_values(array_diff(self::PORTAL_TABLES, $existing));
                $extra = array_values(array_diff($existing, self::PORTAL_TABLES));

                $this->table(['Item', 'Nilai'], [
                    ['Database aktif', $row->db],
                    ['Host', (string) $connection->getConfig('host')],
                    ['PostgreSQL', $row->version],
                    ['SSL aktif', $row->ssl ? 'ya' : 'tidak'],
                    ['Tabel portal ada', count(self::PORTAL_TABLES) - count($missing).' / '.count(self::PORTAL_TABLES)],
                    ['Tabel belum ada', $missing === [] ? '-' : implode(', ', $missing)],
                    ['Tabel di luar daftar', $extra === [] ? '-' : implode(', ', $extra)],
                ]);

                DatabaseGuard::$enabled = true;
                DatabaseGuard::assert($connection);
                DatabaseGuard::$enabled = false;
                $this->line("<fg=green>OK</>: {$name} memakai \"".DatabaseGuard::EXPECTED.'"');
            } catch (Throwable $e) {
                DatabaseGuard::$enabled = false;
                $failed = true;
                // PDO messages can echo the DSN; print only the class and the guard's own message.
                $message = str_starts_with($e->getMessage(), 'DatabaseGuard') ? $e->getMessage() : class_basename($e).': koneksi gagal';
                $this->error("{$name}: {$message}");
            }
        }

        return $failed ? self::FAILURE : self::SUCCESS;
    }
}
