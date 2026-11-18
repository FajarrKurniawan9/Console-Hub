<?php

namespace App\Connectors;

use App\Support\ApiException;
use Symfony\Component\HttpFoundation\IpUtils;

/**
 * Anti-SSRF checks for console base URLs.
 */
class HostGuard
{
    /** Cloud metadata hosts that are never allowed, even in development. */
    private const METADATA_HOSTS = ['169.254.169.254', 'fd00:ec2::254', 'metadata.google.internal', 'metadata.azure.com'];

    /**
     * Return a human readable reason when the base URL is not allowed, or null when it is.
     */
    public function violation(string $baseUrl): ?string
    {
        $parts = parse_url($baseUrl);
        $scheme = strtolower($parts['scheme'] ?? '');
        $host = strtolower(trim($parts['host'] ?? '', '[]'));

        if ($host === '' || ! in_array($scheme, ['http', 'https'], true)) {
            return 'URL harus berupa http(s) dengan host yang valid.';
        }

        if (isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])) {
            return 'URL tidak boleh berisi kredensial, query, atau fragment.';
        }

        if (in_array($host, self::METADATA_HOSTS, true)) {
            return 'Alamat metadata cloud tidak diizinkan.';
        }

        if ($this->allowPrivate()) {
            return null;
        }

        if ($scheme !== 'https') {
            return 'URL console harus memakai https.';
        }

        $addresses = $this->resolve($host);

        if ($addresses === []) {
            return "Host {$host} tidak dapat di-resolve.";
        }

        foreach ($addresses as $address) {
            if (IpUtils::isPrivateIp($address) || in_array($address, self::METADATA_HOSTS, true)) {
                return 'Alamat privat, loopback, atau link-local tidak diizinkan.';
            }
        }

        return null;
    }

    /**
     * @throws ApiException
     */
    public function assertAllowed(string $baseUrl, string $field = 'base_url'): void
    {
        if ($reason = $this->violation($baseUrl)) {
            throw ApiException::validation([$field => [$reason]]);
        }
    }

    protected function allowPrivate(): bool
    {
        return (bool) config('consolehub.allow_private_hosts');
    }

    /**
     * @return list<string>
     */
    protected function resolve(string $host): array
    {
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return [$host];
        }

        $records = @dns_get_record($host, DNS_A | DNS_AAAA) ?: [];

        return array_values(array_filter(array_map(fn (array $r) => $r['ip'] ?? $r['ipv6'] ?? null, $records)));
    }
}
