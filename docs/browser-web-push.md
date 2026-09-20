<!--
SPDX-FileCopyrightText: 2026 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# Browser Web Push

Browser Web Push is a browser/PWA client responsibility coordinated with the
selected deployment's API. The frontend reads Web Push availability and public
runtime metadata from `GET /v1/bootstrap?client_platform=browser`; it does not
use a build-time VAPID-key fallback.

Registration requires HTTPS, notification permission, and an active
same-origin service worker. Registrations belong to the signed-in browser
profile and selected deployment origin. Signing out revokes the authenticated
installation and clears the local subscription state.

The API remains authoritative for whether the selected deployment enables the
channel and for the authenticated notification-installation resource.

## Workspace-preview smoke test

The maintained live smoke is intentionally limited to a Polyscope workspace
preview. It does not accept pure live targets such as `app.secpal.dev`.

Run it inside the selected frontend workspace with a stable system
Chrome/Chromium binary:

```bash
export CHROME_PATH=/usr/bin/chromium
npm run test:e2e:live:web-push
```

The workspace path normally resolves both
`https://frontend-<workspace>.preview.secpal.dev` and
`https://api-<workspace>.preview.secpal.dev`. When invoking the test outside
that clone path, `PLAYWRIGHT_BASE_URL` must identify a frontend workspace
preview. Set `PLAYWRIGHT_API_BASE_URL` only for an intentional matching-preview
override.

The workspace preview provides the standard seeded test user. Explicit
`TEST_USER_EMAIL` and `TEST_USER_PASSWORD` values may override it.

## Prerequisites

- The selected preview must serve HTTPS and an active same-origin service
  worker controlling the page.
- Bootstrap must enable `features.notification_channels.web_push` and publish
  its public runtime metadata.
- `CHROME_PATH` must point to a stable Chrome/Chromium installation, not the
  bundled Playwright Chromium snapshot.
- The smoke runs a headed persistent Chromium profile. On headless Linux, the
  script starts `/usr/bin/Xvfb` when no display is available; otherwise it
  fails before changing registration state.

## Evidence produced

The smoke verifies:

- browser bootstrap metadata for the selected preview;
- granted notification permission and the secure, same-origin service-worker
  boundary;
- authenticated registration through
  `PUT /v1/me/notification-installations/{installationId}`;
- authenticated revocation through the corresponding `DELETE` during sign-out;
  and
- removal of the browser subscription and local installation identifier.

Failures include bounded browser/runtime and API-exchange diagnostics. The
procedure validates the selected workspace preview; it is not a production
rollout or certification process.
