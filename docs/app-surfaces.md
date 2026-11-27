<!--
SPDX-FileCopyrightText: 2026 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# App surfaces and build metadata

The SecPal frontend is one shared React and TypeScript implementation with
explicit browser- and native-facing build surfaces. Native repositories reuse
the compiled frontend where applicable while retaining responsibility for app
packaging, platform permissions, native authentication transport, secure OS
storage, and store delivery. The iOS entries below describe frontend build targets.

`VITE_APP_SURFACE` selects only the frontend surface contract. It must not be
used for secrets, authentication behavior, authorization, security gates, or
capability decisions.

## Supported surfaces

| Value            | Purpose                                                  |
| ---------------- | -------------------------------------------------------- |
| `web`            | Browser and installable PWA surface                      |
| `android-mock`   | Android-facing local validation without the native shell |
| `android-native` | Android WebView/native integration surface               |
| `ios-mock`       | iOS-facing local validation without a native shell       |
| `ios-native`     | iOS WebView/native integration surface                   |

Mock surfaces are non-production contracts. Production-style Vite builds reject
`android-mock` and `ios-mock` before emitting an artifact.

Use the repository scripts so the surface and Vite mode remain aligned:

| Intent                        | Command                      |
| ----------------------------- | ---------------------------- |
| Browser/PWA development       | `npm run dev:web`            |
| Browser/PWA build             | `npm run build:web`          |
| Android mock development      | `npm run dev:android:mock`   |
| Android mock validation build | `npm run build:android:mock` |
| Android native development    | `npm run dev:android`        |
| Android native artifact       | `npm run build:android`      |
| iOS native development        | `npm run dev:ios`            |
| iOS native artifact           | `npm run build:ios`          |

## Build metadata

Every Vite build emits `build-metadata.json` at the artifact root. Downstream
packaging uses this file to verify the resolved application surface instead of
inferring it from optimized JavaScript.

For example, `npm run build:android` emits:

```json
{
  "schemaVersion": 1,
  "applicationSurface": "android-native",
  "buildMode": "android",
  "production": true
}
```

`applicationSurface` is the validated surface. `buildMode` records the Vite
mode, and `production` distinguishes deployable artifacts from preview/mock
builds. The metadata is deterministic and contains no credentials, runtime API
configuration, timestamps, or host-specific values.

## Playwright surface selection

Local and CI-managed Playwright servers default to the `android-native` surface
so native-facing shared UI stays covered. Select another surface explicitly:

```bash
PLAYWRIGHT_APP_SURFACE=android-mock npm run test:e2e
PLAYWRIGHT_APP_SURFACE=web npm run test:e2e
PLAYWRIGHT_APP_SURFACE=android-native npm run test:e2e
```

Assigned Herdr tabs set `PLAYWRIGHT_BASE_URL` to the private workspace preview.
Browser tests use the same origin for the app and API and default to the
`web` surface. The workspace keeps the surface already compiled into the
deployed bundle. Choose `PLAYWRIGHT_APP_SURFACE` to match the intended test
routes and locally managed server.

For local Android-facing UI review against a workspace API, run
`npm run dev:android:mock` and configure the matching development API origin.

## Browser/PWA boundary

The browser build remains the maintained installable PWA surface. Vite uses
`vite-plugin-pwa` with an `injectManifest` build, the web app Manifest, the
repository service worker, and Workbox. Native surface selection does not
replace this browser/PWA delivery path.

The [service worker source](../src/sw.ts) and its tests describe current
cache and offline behavior.
