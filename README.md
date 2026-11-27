<!--
SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# SecPal Frontend

> SecPal – A guard's best friend

[![Quality Gates](https://github.com/SecPal/frontend/actions/workflows/quality.yml/badge.svg)](https://github.com/SecPal/frontend/actions/workflows/quality.yml)
[![CodeQL](https://github.com/SecPal/frontend/actions/workflows/codeql.yml/badge.svg)](https://github.com/SecPal/frontend/actions/workflows/codeql.yml)

SecPal develops open-source software for physical, organizational and personnel
security. This repository contains the React and TypeScript interface for the
main SecPal product, used by the browser, installable PWA and shared native
shells. See [SecPal's product positioning](https://github.com/SecPal/.github/blob/main/docs/product-positioning.md)
for the audience and current direction.

The frontend owns client routing and presentation, browser session integration,
the service worker, sensitive local state and the shared UI build. Server-side
authentication, authorization and tenant isolation belong to the
[API](https://github.com/SecPal/api). Client routing and visibility describe
presentation only. [Contracts](https://github.com/SecPal/contracts) defines the
HTTP interface. [Android](https://github.com/SecPal/android) owns native
packaging, OS integration and platform credential storage.
[Deployment](https://github.com/SecPal/deployment) owns portable integration,
self-hosting and public-edge configuration.

## Quick start

Use Node.js `^26.10.0` and npm 10 or newer.

```bash
npm ci
npm run dev:web
```

The development server proxies API requests to `http://localhost:8000` by
default. Set `VITE_API_URL` to use a different development API origin. Follow
[the contribution guide](CONTRIBUTING.md) for local checks and review, including
advisory PR-size reporting, and the [Herdr workspace guide](https://github.com/SecPal/.github/blob/main/WORKSPACE_SETUP.md)
for private previews.

## Documentation

| Task                                                               | Guide                                                                                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Work on shared UI components                                       | [UI architecture](docs/ui-architecture.md)                                                                          |
| Build browser or native-facing artifacts and select a test surface | [App surfaces and build metadata](docs/app-surfaces.md)                                                             |
| Understand client routing and authorization presentation           | [Route access policy](docs/ROUTE_ACCESS_POLICY.md)                                                                  |
| Maintain the frontend Content Security Policy                      | [Static CSP contract](docs/security/csp.md)                                                                         |
| Validate browser Web Push in a workspace                           | [Browser Web Push](docs/browser-web-push.md)                                                                        |
| Consume frontend images and configure their runtime API origin     | [Frontend container](docs/deployment/frontend-container.md) and [delivery boundary](docs/deployment-spa-routing.md) |
| Extract, compile and verify translations                           | [Lingui scripts](package.json)                                                                                      |

Report vulnerabilities through the private process in [SECURITY.md](SECURITY.md).
File-level SPDX and [REUSE](REUSE.toml) metadata describe licensing. See
[LICENSE](LICENSE) for the project license.
