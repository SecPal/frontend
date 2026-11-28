<!-- SPDX-FileCopyrightText: 2025-2026 SecPal Contributors -->
<!-- SPDX-License-Identifier: CC0-1.0 -->

# Security policy

## Reporting a vulnerability

Report vulnerabilities privately through GitHub Security Advisories. If you
cannot use GitHub, email <security@secpal.app>. A PGP key is available on request.
[Report a vulnerability](https://github.com/SecPal/frontend/security/advisories/new)

Include the affected revision or build, the browser, PWA or native surface,
steps to reproduce, and potential impact. Use the private channel for
coordinated disclosure. [Published advisories](https://github.com/SecPal/frontend/security/advisories)

## Frontend security boundaries

The shared build carries a static Content Security Policy. Route visibility
guides client navigation. The shared service supplies CSRF tokens to browser
API requests where required. Sensitive authentication state uses encrypted storage.
[Static CSP](docs/security/csp.md) · [Route access policy](docs/ROUTE_ACCESS_POLICY.md) ·
[CSRF service](src/services/csrf.ts) · [Frontend invariants](AGENTS.md#frontend-security-and-lifecycle-invariants)

The API owns session cookies, server-side authorization and tenant isolation.
Use the API's browser session guide for origin, cookie and CSRF configuration,
and the OpenAPI specification for request and response details.
[API browser session guide](https://github.com/SecPal/api/blob/main/docs/guides/sanctum-spa-auth.md) ·
[OpenAPI specification](https://github.com/SecPal/contracts/blob/main/docs/openapi.yaml)
