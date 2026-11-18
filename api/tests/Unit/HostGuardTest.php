<?php

use App\Connectors\HostGuard;

beforeEach(fn () => config(['consolehub.allow_private_hosts' => false]));

it('rejects private, loopback, link-local and metadata addresses in production mode', function (string $url) {
    expect(app(HostGuard::class)->violation($url))->not->toBeNull();
})->with([
    'https://127.0.0.1',
    'https://10.0.0.5',
    'https://192.168.1.1',
    'https://172.16.0.1',
    'https://169.254.169.254',
    'https://[::1]',
    'https://[fe80::1]',
    'http://8.8.8.8',
    'ftp://example.com',
    'https://user:pass@8.8.8.8',
]);

it('rejects hostnames that resolve to private addresses', function () {
    $guard = new class extends HostGuard
    {
        protected function resolve(string $host): array
        {
            return ['10.1.2.3'];
        }
    };

    expect($guard->violation('https://internal.example.com'))->toContain('privat');
});

it('accepts public https hosts', function () {
    $guard = new class extends HostGuard
    {
        protected function resolve(string $host): array
        {
            return ['93.184.216.34'];
        }
    };

    expect($guard->violation('https://console.example.com'))->toBeNull();
});

it('allows local hosts in development but still blocks metadata', function () {
    config(['consolehub.allow_private_hosts' => true]);
    $guard = app(HostGuard::class);

    expect($guard->violation('http://localhost:4001'))->toBeNull()
        ->and($guard->violation('http://169.254.169.254'))->not->toBeNull();
});
