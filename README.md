<!--
SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# SecPal Frontend

> SecPal – A guard's best friend

[![Quality Gates](https://github.com/SecPal/frontend/actions/workflows/quality.yml/badge.svg)](https://github.com/SecPal/frontend/actions/workflows/quality.yml)
[![CodeQL](https://github.com/SecPal/frontend/actions/workflows/codeql.yml/badge.svg)](https://github.com/SecPal/frontend/actions/workflows/codeql.yml)
[![License](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)

## About

SecPal is open-source operations software for professional security operations,
including private security services, in-house and plant protection, corporate
security, and comparable operational security organisations. This repository
contains the frontend for the main SecPal product.

SecPal is under active development and remains pre-1.0.

## Repository responsibilities

This repository owns the shared React and TypeScript UI used by the browser/PWA
and reused, where applicable, by native shells. It also owns browser-specific
client behavior, frontend routing and presentation, service-worker integration,
sensitive local-state boundaries, runtime API-origin handling, and the build
artifacts consumed by downstream packaging.

One codebase supports explicit browser- and native-facing surface contracts.
The selected surface changes presentation and platform integration; it is not a
security capability or authorization decision. See
[App surfaces and build metadata](docs/app-surfaces.md) for the detailed
contract.

This repository does not own server-side authentication or authorization, the
public API contract, native OS packaging and secure storage, or deployment and
public-edge infrastructure. Those responsibilities belong to the related
repositories listed below.

## Security-sensitive client boundaries

The frontend participates in browser session and CSRF handling, login context,
MFA and passkey flows, route and access presentation, encrypted client-side
state, offline/local persistence, service-worker and PWA behavior, runtime
deployment binding, Content Security Policy, and native/web surface separation.

Client-side route and control visibility improves the user experience but does
not grant or enforce authorization. The API remains authoritative for
server-side authentication, authorization, tenant isolation, and data access.

Architecture references include the
[route access policy](docs/ROUTE_ACCESS_POLICY.md),
[static CSP contract](docs/security/csp.md), and
[frontend delivery boundary](docs/deployment-spa-routing.md). Report suspected
vulnerabilities through the private process in [SECURITY.md](SECURITY.md).

## Technology

The frontend uses React, TypeScript, Vite, Tailwind CSS, Base UI, Lingui,
Vitest, Testing Library, and Playwright. The browser/PWA build uses a custom
Workbox service worker through `vite-plugin-pwa`.

## Quick start

Local development requires Node.js `^24.21.0` (the repository pins major 24 in
`.nvmrc`) and npm 10 or newer.

```bash
npm ci
npm run dev:web
```

The development server proxies API requests to `http://localhost:8000` by
default. Configure `VITE_API_URL` when using another development API origin.

Run the primary local checks with:

```bash
npm test
npm run typecheck
npm run lint
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for hooks, complete validation, and the
pull-request workflow.

## Documentation

| Intent                                                  | Authority                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Frontend architecture and UI components                 | [UI architecture](docs/ui-architecture.md)                                           |
| Browser/native surface selection and packaging metadata | [App surfaces and build metadata](docs/app-surfaces.md)                              |
| Route and access presentation                           | [Route access policy](docs/ROUTE_ACCESS_POLICY.md)                                   |
| Frontend-owned CSP                                      | [Static CSP contract](docs/security/csp.md)                                          |
| Browser Web Push validation                             | [Browser Web Push](docs/browser-web-push.md)                                         |
| Frontend image and runtime API binding                  | [Frontend container](docs/deployment/frontend-container.md)                          |
| Frontend/deployment ownership boundary                  | [Frontend delivery boundary](docs/deployment-spa-routing.md)                         |
| Development, validation, and testing                    | [Contributing](CONTRIBUTING.md) and [TDD workflow](docs/development/TDD_WORKFLOW.md) |
| Public API contract                                     | [SecPal/contracts](https://github.com/SecPal/contracts)                              |
| Self-hosting and deployment                             | [SecPal/deployment](https://github.com/SecPal/deployment)                            |

## Related repositories

- [SecPal/api](https://github.com/SecPal/api) — server-side authentication,
  authorization, persistence, and business behavior.
- [SecPal/contracts](https://github.com/SecPal/contracts) — public OpenAPI
  contract shared by clients and the API.
- [SecPal/android](https://github.com/SecPal/android) — Android packaging,
  native authentication transport, secure platform storage, and OS integration.
- [SecPal/deployment](https://github.com/SecPal/deployment) — public integration,
  self-hosting, runtime composition, and deployment contracts.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## Security

Do not report vulnerabilities in public issues. Follow the private reporting
process in [SECURITY.md](SECURITY.md).

## License

Repository-owned frontend code is licensed under `AGPL-3.0-or-later` where
indicated. File-level SPDX and [REUSE](REUSE.toml) metadata is authoritative;
see [LICENSE](LICENSE) for the license text.
