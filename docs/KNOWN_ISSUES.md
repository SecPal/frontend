<!--
SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# Known Issues

This document tracks known issues that are outside our direct control and require upstream fixes.

## npm Deprecation Warnings

### Status: Audit Clean, Remaining Deprecations Await Upstream Fixes

When running `npm ci` or fresh `npm install`, you may still see deprecation warnings for the following packages:

```text
npm warn deprecated glob@11.1.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update.

npm warn deprecated sourcemap-codec@1.4.8: Please use @jridgewell/sourcemap-codec instead

npm warn deprecated source-map@0.8.0-beta.0: The work that was done in this beta
  branch won't be included in future versions
```

### Root Cause

These are **transitive dependencies** from packages that currently have no compatible upstream replacement in this repo's supported toolchain:

- `vite-plugin-pwa@1.2.0` → `workbox-build@7.4.0` → `glob@11.1.0`
- `vite-plugin-pwa@1.2.0` → `workbox-build@7.4.0` → `@rollup/plugin-replace@2.x` / `magic-string@0.25.9` → `sourcemap-codec@1.4.8`
- `vite-plugin-pwa@1.2.0` → `workbox-build@7.4.0` → `source-map@0.8.0-beta.0`

The previously observed `@lhci/cli` → `chrome-launcher` → `rimraf` / `glob@7.2.3` / `inflight@1.0.6` chain was removed from regular installs on 2026-03-21 by switching local Lighthouse CLI usage to on-demand `npx` execution.

The previously tracked `npm audit` findings for `brace-expansion` and `serialize-javascript` were eliminated on 2026-03-27 by raising the frontend override floors to patched releases. `npm audit` now reports 0 vulnerabilities in this repository.

### Impact Assessment

- **Security**: ✅ `npm audit` is clean; no known runtime CVEs remain in the current dependency graph
- **Deprecated Build Tooling**: ⚠️ Limited to build-time and local tooling paths, not shipped runtime code
- **Functionality**: ✅ All features work correctly
- **Build Process**: ✅ No impact on build or runtime

### Why We Can't Fix This Directly

1. **`workbox-build@7.4.0`** is still the latest release and still depends on `glob@11.1.0`, `sourcemap-codec@1.4.8`, and `source-map@0.8.0-beta.0`
2. **`vite-plugin-pwa@1.2.0`** is still the latest release and still depends on `workbox-build@7.4.0`
3. **npm overrides** would force unverified major-version replacements into build tooling
4. **Forking/patching** would create permanent maintenance overhead for non-runtime warnings

### What We're Doing

- ✅ Removed the direct `@lhci/cli` install path from normal dependency installation
- ✅ Raised `brace-expansion` and `serialize-javascript` override floors so `npm audit` now returns 0 vulnerabilities
- ✅ Monitoring upstream repositories for updates
- ✅ Testing new versions as they're released
- ✅ Documented in this file for team awareness
- ⏳ Waiting for `workbox-build` and `vite-plugin-pwa` updates that replace the remaining deprecated transitive packages

### Upstream Issues

- [GoogleChrome/workbox#3252](https://github.com/GoogleChrome/workbox/issues/3252) - Tracking deprecated dependencies
- [vite-pwa/vite-plugin-pwa#854](https://github.com/vite-pwa/vite-plugin-pwa/issues/854) - Workbox 8.x support

### Related Internal Tracking

- Issue #558 - Remaining deprecated transitive frontend tooling dependencies
- Issue #559 - Vite 8 peer mismatch with `vite-plugin-pwa@1.2.0`

### Workaround for Cleaner Local Installs

If you only need Lighthouse CI occasionally, the local scripts now fetch `@lhci/cli` on demand instead of during every regular install:

```bash
npm run lighthouse:ci
```

**Note:** The remaining install-time warnings come from upstream build-tool dependencies. We still recommend leaving them visible so new regressions are not hidden.

We will update dependencies as soon as stable upstream releases make that possible without forcing unverified overrides.

---

**Last Updated**: 2026-03-27
**Reviewed By**: SecPal Team
**Status**: Accepted Risk (Deprecations Only)

---

## ESLint 9 and Global minimatch Override

### Status: Intentional, Confirmed Compatible

Package `@eslint/config-array` (pulled in by ESLint 9.x) declares `minimatch@^3.1.5`, but `package.json` contains a global `overrides.minimatch: ">=10.2.4"` that forces all minimatch resolutions to the `10.x` line.

### Why the Override Exists

The global `minimatch` override enforces a minimum version across the entire dependency tree as a precautionary floor against any packages that may still reference an old minimatch range. The specific `>=10.2.4` boundary was chosen to align with versions already required by other tooling in this repo (e.g. `typescript-eslint` requires `^10.2.2`).

### Compatibility

ESLint 9 uses minimatch exclusively for internal glob pattern matching (config file/ignore patterns). The glob API surface used is backward compatible between minimatch 3.x and 10.x. This is confirmed by all CI lint checks passing with `minimatch@10.2.4` in the resolved lock.

### Impact Assessment

- **Security**: ✅ No regression — minimatch 10 fixes all known CVEs present in older 3.x releases
- **Functionality**: ✅ All ESLint checks pass in CI with minimatch@10.2.4
- **Maintainability**: ✅ Intentional — no remediation required unless a future ESLint or minimatch release breaks the current API contract

---

**Last Updated**: 2026-03-21
**Reviewed By**: SecPal Team
**Status**: Accepted Risk (Intentional Override)
