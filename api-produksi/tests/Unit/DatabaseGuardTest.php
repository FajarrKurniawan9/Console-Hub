<?php

namespace Tests\Unit;

use App\Support\DatabaseGuard;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class DatabaseGuardTest extends TestCase
{
    protected function tearDown(): void
    {
        DatabaseGuard::$resolver = null;
        DatabaseGuard::$enabled = true;

        parent::tearDown();
    }

    public function test_passes_when_the_active_database_matches_expected_database(): void
    {
        DatabaseGuard::$resolver = fn () => 'console_produksi';

        DatabaseGuard::assert();
        $this->assertTrue(true);
    }

    public function test_passes_when_the_active_database_matches_expected_database_with_hyphen(): void
    {
        DatabaseGuard::$resolver = fn () => 'console-produksi';

        DatabaseGuard::assert();
        $this->assertTrue(true);
    }

    public function test_refuses_any_other_database_name(): void
    {
        $disallowed = ['neondb', 'console_gudang', 'consolehub_test', 'console_hr', 'postgres'];

        foreach ($disallowed as $name) {
            DatabaseGuard::$resolver = fn () => $name;

            try {
                DatabaseGuard::assert();
                $this->fail("Expected RuntimeException for database name: {$name}");
            } catch (RuntimeException $e) {
                $this->assertStringContainsString('Periksa DB_DATABASE / EXPECTED_DB di .env.', $e->getMessage());
            }
        }
    }

    public function test_asks_the_server_for_current_database_when_no_resolver_is_set(): void
    {
        $connection = DB::connection();
        $this->assertSame($connection->getDatabaseName(), DatabaseGuard::currentDatabase($connection));
    }
}
