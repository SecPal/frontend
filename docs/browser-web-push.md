<!--
SPDX-FileCopyrightText: 2026 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# Browser Web Push

The browser uses the selected deployment's public bootstrap metadata to
determine Web Push availability and registration settings. Registration
requires HTTPS, notification permission and a same-origin service worker
controlling the page. The API owns the deployment's channel state and the
authenticated notification installation. The
[OpenAPI contract](https://github.com/SecPal/contracts/blob/main/docs/openapi.yaml)
defines the resource and its operations.

## Workspace smoke test

Run the live smoke in an assigned Herdr frontend tab using stable Chrome or
Chromium. The app and API share the workspace's private HTTPS origin. Outside
the assigned tab, set `PLAYWRIGHT_BASE_URL` to that workspace origin.

```bash
export CHROME_PATH=/usr/bin/chromium
npm run test:e2e:live:web-push
```

The workspace needs browser-session sign-in, browser push configuration in
bootstrap, and an active service worker. The smoke uses a persistent Chromium
profile with a display. On headless Linux it starts `/usr/bin/Xvfb` if available.
To select a dedicated workspace account, set `TEST_USER_EMAIL` and
`TEST_USER_PASSWORD` together.

The smoke checks bootstrap metadata, browser notification permission,
authenticated installation registration and deletion during sign-out, and removal
of the local subscription and installation identifier. Its evidence applies to
the selected workspace. The
[smoke runner](../scripts/run-live-web-push-smoke.mjs) enforces the preview
boundary and reports failures.
