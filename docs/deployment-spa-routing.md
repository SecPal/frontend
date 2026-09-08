<!--
SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# Frontend Delivery Boundary

SecPal/frontend delivers one immutable Web/PWA artifact and its unprivileged
static container. It does not define a second production hosting path.

## Frontend-Owned Contract

The official image is `ghcr.io/secpal/frontend`. It serves the immutable
frontend artifact through an unprivileged Nginx workload on HTTP port `8080`.
The workload:

- injects the exact `SECPAL_API_URL` HTTPS origin only at container startup;
- serves existing static files and falls back to `index.html` for React Router;
- returns `404` for API and reserved health paths other than `/health/live`;
- keeps the artifact CSP in `index.html`, with no inline script or style
  requirement;
- supplies container-local static response hardening and PWA cache behavior;
- exposes `/health/live` for the workload liveness check.

`SECPAL_API_URL` must be one exact HTTPS origin, such as
`https://api.secpal.dev`; it is runtime configuration, not a build-time
deployment alternative.

The image, runtime API-origin validation, cache rules, source-offer delivery,
PWA files, and local container verification are documented in the
[frontend container guide](deployment/frontend-container.md).

## Deployment Ownership

Host runtime composition, public routing, TLS, certificates, ACME, public
listeners, and public-edge policy are owned by
[SecPal/deployment#248](https://github.com/SecPal/deployment/issues/248) and
its delivery graph. Consume the frontend image by its verified OCI index digest
there; do not add host configuration or artifact-copy deployment instructions
to this repository.

`app.secpal.dev` remains a valid live/E2E target identity. Its runtime
ownership does not change this frontend artifact contract.
