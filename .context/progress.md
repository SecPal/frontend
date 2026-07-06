## Codebase Patterns

- Platform/runtime helpers use small, side-effect-free modules with top-level
  constants or pure functions and focused Vitest coverage near the helper.
- Real fixes and feature slices update `CHANGELOG.md` under `[Unreleased]` in
  the same change set.
- Env-derived platform helpers are tested with `vi.stubEnv()`, dynamic imports,
  `vi.unstubAllEnvs()`, and `vi.resetModules()` so top-level constants are
  re-evaluated per scenario.

## US-001: Capacitor Runtime Basis ohne Projekt-Scaffold

- Implemented `@capacitor/core` as a normal runtime dependency only.
- Added `src/platform/runtime.ts` exporting `runtimePlatform`,
  `isNativeRuntime`, `isWebRuntime`, `isAndroidRuntime`, and `isIosRuntime`
  from `Capacitor.getPlatform()` / `Capacitor.isNativePlatform()`.
- Added focused Vitest coverage for web, Android, and iOS runtime flags.
- Preserved existing PWA/Workbox and native-runtime cleanup files without
  introducing Capacitor config, Android, or iOS scaffold files.
- Files changed: `package.json`, `package-lock.json`, `CHANGELOG.md`,
  `src/platform/runtime.ts`, `src/platform/runtime.test.ts`,
  `.context/progress.md`.
- **Learnings for future iterations:**
  - Existing native runtime cleanup lives in `src/lib/nativeRuntime.ts` and is
    still global-runtime based for cleanup behavior.
  - The repository already treats `CHANGELOG.md` updates as mandatory for real
    feature slices.

## US-002: Surface-Konfiguration mit strikter Validierung

- Implemented `src/platform/appSurface.ts` with the exact `AppSurface` union
  values `web`, `android-mock`, `android-native`, `ios-mock`, and `ios-native`.
- Defaulted empty `VITE_APP_SURFACE` to `web`, exported all requested
  convenience flags, and fail fast for invalid configured values in all modes.
- Added production guards that reject `android-mock` and `ios-mock` when
  `import.meta.env.PROD` is true.
- Added focused Vitest coverage for default web, every non-web surface,
  invalid values, and the production mock-surface guard.
- Updated `CHANGELOG.md` for the feature slice.
- Files changed: `CHANGELOG.md`, `src/platform/appSurface.ts`,
  `src/platform/appSurface.test.ts`, `.context/progress.md`.
- **Learnings for future iterations:**
  - Top-level env-derived exports need dynamic imports plus module resets in
    tests to keep scenarios isolated.
  - Vitest can stub `import.meta.env.PROD` directly for production guard tests.
