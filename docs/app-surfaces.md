<!--
SPDX-FileCopyrightText: 2026 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# App surfaces and build metadata

The SecPal frontend is one shared React and TypeScript implementation with
explicit browser- and native-facing build surfaces. Native repositories reuse
the compiled frontend where applicable while retaining responsibility for app
packaging, platform permissions, native authentication transport, secure OS
storage, and store delivery.

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

Remote Polyscope workspace previews default Playwright's route assumptions to
`web` and keep the surface already compiled into the deployed bundle. Setting
`PLAYWRIGHT_APP_SURFACE` changes test selection and any Playwright-managed local
server; it cannot replace the surface embedded in an existing remote artifact.

For local Android-facing UI review against a workspace API, run
`npm run dev:android:mock` and configure the matching development API origin.

## Browser/PWA boundary

The browser build remains the maintained installable PWA surface. Vite uses
`vite-plugin-pwa` with an `injectManifest` build, the web app Manifest, the
repository service worker, and Workbox. Native surface selection does not
replace this browser/PWA delivery path.

Current service-worker and offline behavior is defined by the implementation
and its tests. Historical audit and design documents describe the state at the
time they were written and must not be treated as proof that a proposed or
earlier behavior is current.
